"""Automated unit and integration test suite for Attendance State Machine logic."""

from datetime import date, datetime, timedelta
import pytest
from sqlalchemy.orm import Session

from backend.app.core.security import UserRole
from backend.app.models.attendance import AttendanceLog
from backend.app.models.user import User
from backend.app.schemas.attendance import AttendanceEventResultEnum, AttendanceStatusEnum
from backend.app.services.attendance_service import (
    get_daily_summary,
    get_employee_status,
    mark_manual_attendance,
    record_attendance_event,
)


def test_first_detection_creates_check_in(db_session: Session, seed_department_and_users: dict):
    """Verify first detection of the day registers as CHECKED_IN with PRESENT status."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    t = datetime(2026, 10, 26, 9, 0, 0)  # 09:00:00 AM (shift start is 09:15)

    result = record_attendance_event(
        db=db_session,
        employee_id=user.employee_id,
        timestamp=t,
        source="KIOSK",
    )

    assert result.event_result == AttendanceEventResultEnum.CHECKED_IN
    assert result.is_late is False
    assert result.status == AttendanceStatusEnum.PRESENT.value
    assert result.check_in_time == t
    assert result.check_out_time is None
    assert result.total_hours is None
    assert result.employee_id == user.employee_id

    # Verify persisted in database
    log = (
        db_session.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == t.date())
        .first()
    )
    assert log is not None
    assert log.check_in_time == t
    assert log.check_out_time is None
    assert log.is_late is False
    assert log.status == "PRESENT"


def test_cooldown_window_suppression(db_session: Session, seed_department_and_users: dict):
    """Verify duplicate detections within 5-minute cooldown window are suppressed as COOLDOWN_IGNORED."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    t_first = datetime(2026, 10, 26, 9, 0, 0)
    t_duplicate = t_first + timedelta(minutes=2, seconds=30)  # 2.5 minutes later

    res_1 = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_first)
    assert res_1.event_result == AttendanceEventResultEnum.CHECKED_IN

    res_2 = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_duplicate)
    assert res_2.event_result == AttendanceEventResultEnum.COOLDOWN_IGNORED
    assert "cooldown window ignored" in res_2.message.lower()

    # DB record should not have check_out_time modified
    log = (
        db_session.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == t_first.date())
        .first()
    )
    assert log.check_out_time is None
    assert log.total_hours is None


def test_detection_after_cooldown_registers_checkout(
    db_session: Session, seed_department_and_users: dict
):
    """Verify detection after cooldown registers as CHECKED_OUT and calculates total hours."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    t_check_in = datetime(2026, 10, 26, 9, 0, 0)
    t_check_out = datetime(2026, 10, 26, 17, 30, 0)  # 8.5 hours later

    record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_check_in)

    res_checkout = record_attendance_event(
        db=db_session,
        employee_id=user.employee_id,
        timestamp=t_check_out,
    )

    assert res_checkout.event_result == AttendanceEventResultEnum.CHECKED_OUT
    assert res_checkout.check_out_time == t_check_out
    assert res_checkout.total_hours == 8.5
    assert res_checkout.duration_hours == 8.5

    # Verify DB record
    log = (
        db_session.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == t_check_in.date())
        .first()
    )
    assert log.check_out_time == t_check_out
    assert log.total_hours == 8.5


def test_subsequent_scan_after_checkout_is_ignored_and_locks_checkout(
    db_session: Session, seed_department_and_users: dict
):
    """Verify once employee checks out for the day, subsequent detections do not overwrite duration."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    t_in = datetime(2026, 10, 26, 9, 0, 0)
    t_out_1 = datetime(2026, 10, 26, 17, 0, 0)   # 8.0 hours
    t_out_2 = datetime(2026, 10, 26, 18, 30, 0)  # subsequent scan 1.5 hours later

    record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_in)
    res_1 = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_out_1)
    assert res_1.event_result == AttendanceEventResultEnum.CHECKED_OUT
    assert res_1.total_hours == 8.0

    res_2 = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_out_2)
    assert res_2.event_result == AttendanceEventResultEnum.COOLDOWN_IGNORED
    assert "Already Checked Out" in res_2.message
    assert res_2.check_out_time == t_out_1
    assert res_2.total_hours == 8.0

    log = (
        db_session.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == t_in.date())
        .first()
    )
    assert log.check_out_time == t_out_1
    assert log.total_hours == 8.0


def test_late_arrival_flagging_after_shift_cutoff(
    db_session: Session, seed_department_and_users: dict
):
    """Verify check-in after shift cutoff (09:15 AM) flags is_late=True and status=LATE."""
    user: User = seed_department_and_users["users"][UserRole.HR]
    t_late = datetime(2026, 10, 26, 9, 25, 0)  # 09:25 AM > 09:15 AM

    res = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_late)

    assert res.event_result == AttendanceEventResultEnum.CHECKED_IN
    assert res.is_late is True
    assert res.status == AttendanceStatusEnum.LATE.value

    log = (
        db_session.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == t_late.date())
        .first()
    )
    assert log.is_late is True
    assert log.status == "LATE"


def test_on_time_arrival_at_or_before_cutoff(
    db_session: Session, seed_department_and_users: dict
):
    """Verify check-in exactly at shift cutoff (09:15:00) is marked on-time (PRESENT)."""
    user: User = seed_department_and_users["users"][UserRole.MANAGER]
    t_ontime = datetime(2026, 10, 26, 9, 15, 0)  # Exactly 09:15:00

    res = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_ontime)

    assert res.event_result == AttendanceEventResultEnum.CHECKED_IN
    assert res.is_late is False
    assert res.status == AttendanceStatusEnum.PRESENT.value


def test_custom_employee_shift_start_time(
    db_session: Session, seed_department_and_users: dict
):
    """Verify custom shift start times configured on individual employee records."""
    user: User = seed_department_and_users["users"][UserRole.ADMIN]
    user.shift_start = "10:00"
    db_session.commit()

    # 09:45 AM check-in should NOT be late for a 10:00 AM shift
    t = datetime(2026, 10, 26, 9, 45, 0)
    res = record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t)
    assert res.is_late is False
    assert res.status == "PRESENT"


def test_get_daily_summary_aggregation(
    db_session: Session, seed_department_and_users: dict
):
    """Verify daily attendance metrics aggregation across multiple employees."""
    users = seed_department_and_users["users"]
    target = date(2026, 10, 26)

    # 1. Admin checks in on time
    record_attendance_event(
        db=db_session,
        employee_id=users[UserRole.ADMIN].employee_id,
        timestamp=datetime(2026, 10, 26, 9, 0, 0),
    )
    # 2. HR checks in late
    record_attendance_event(
        db=db_session,
        employee_id=users[UserRole.HR].employee_id,
        timestamp=datetime(2026, 10, 26, 9, 30, 0),
    )
    # 3. Manager checks in on time and checks out
    record_attendance_event(
        db=db_session,
        employee_id=users[UserRole.MANAGER].employee_id,
        timestamp=datetime(2026, 10, 26, 8, 55, 0),
    )
    record_attendance_event(
        db=db_session,
        employee_id=users[UserRole.MANAGER].employee_id,
        timestamp=datetime(2026, 10, 26, 17, 0, 0),
    )
    # 4. Employee is absent (no check in)

    summary = get_daily_summary(db=db_session, target_date=target)

    assert summary.date == target
    assert summary.total_employees == 4
    assert summary.present_count == 3
    assert summary.late_count == 1
    assert summary.absent_count == 1
    assert summary.attendance_rate == 75.0

    # Department breakdown
    assert len(summary.department_stats) >= 1
    eng_stat = summary.department_stats[0]
    assert eng_stat.department_name == "Engineering"
    assert eng_stat.total_employees == 4
    assert eng_stat.present_count == 3
    assert eng_stat.late_count == 1
    assert eng_stat.absent_count == 1
    assert eng_stat.attendance_rate == 75.0


def test_get_employee_status_lifecycle(
    db_session: Session, seed_department_and_users: dict
):
    """Verify employee status retrieval across before-checkin, checked-in, and checked-out."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    target = date(2026, 10, 26)

    # Before check-in
    st_0 = get_employee_status(db=db_session, employee_id=user.employee_id, target_date=target)
    assert st_0.is_checked_in is False
    assert st_0.is_checked_out is False
    assert st_0.status == "NOT_CHECKED_IN"

    # After check-in
    t_in = datetime(2026, 10, 26, 9, 10, 0)
    record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_in)
    st_1 = get_employee_status(db=db_session, employee_id=user.employee_id, target_date=target)
    assert st_1.is_checked_in is True
    assert st_1.is_checked_out is False
    assert st_1.check_in_time == t_in
    assert st_1.status == "PRESENT"

    # After checkout
    t_out = datetime(2026, 10, 26, 18, 10, 0)
    record_attendance_event(db=db_session, employee_id=user.employee_id, timestamp=t_out)
    st_2 = get_employee_status(db=db_session, employee_id=user.employee_id, target_date=target)
    assert st_2.is_checked_in is True
    assert st_2.is_checked_out is True
    assert st_2.check_out_time == t_out
    assert st_2.total_hours == 9.0


def test_mark_manual_attendance(
    db_session: Session, seed_department_and_users: dict
):
    """Verify manual attendance adjustments and record creation."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    target = date(2026, 10, 25)  # yesterday
    t_in = datetime(2026, 10, 25, 9, 0, 0)
    t_out = datetime(2026, 10, 25, 17, 0, 0)

    log = mark_manual_attendance(
        db=db_session,
        employee_id=user.employee_id,
        target_date=target,
        check_in_time=t_in,
        check_out_time=t_out,
        status="PRESENT",
        is_late=False,
        notes="HR approved remote work retroactive mark",
    )

    assert log.id is not None
    assert log.source == "MANUAL"
    assert log.total_hours == 8.0
    assert log.notes == "HR approved remote work retroactive mark"
