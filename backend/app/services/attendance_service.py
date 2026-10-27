"""Attendance State Machine and business logic service.

Provides:
- Dual Check-In / Check-Out state tracking with cooldown suppression.
- Shift start evaluation and automatic late arrival flagging.
- Real-time employee status lookups and daily attendance summaries.
- Manual attendance adjustments for HR/Admin.
"""

from datetime import date, datetime, time, timezone
from typing import List, Optional, Union

from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.attendance import AttendanceLog
from backend.app.models.department import Department
from backend.app.models.user import User
from backend.app.schemas.attendance import (
    AttendanceEventResultEnum,
    AttendanceResult,
    AttendanceStatusEnum,
    CheckInStatusResponse,
    DailySummaryResponse,
    DepartmentSummary,
)


def _parse_shift_time(shift_str: Optional[str]) -> time:
    """Parse a 'HH:MM' shift start string into a datetime.time object."""
    raw = (shift_str or settings.SHIFT_START_TIME or "09:15").strip()
    try:
        parts = raw.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour, minute)
    except Exception:
        return time(9, 15)


def record_attendance_event(
    db: Session,
    employee_id: Union[str, int],
    timestamp: Optional[datetime] = None,
    source: str = "KIOSK",
    notes: Optional[str] = None,
    cooldown_minutes: Optional[int] = None,
) -> AttendanceResult:
    """Record a facial recognition or attendance event for an employee.

    State Machine Rules:
    1. First detection of the day:
       - Registers as 'Check-In' (`AttendanceEventResultEnum.CHECKED_IN`).
       - Compares detection time against employee's `shift_start` (e.g. 09:15).
         * check_in_time > shift_start -> `is_late = True`, status = `LATE`.
         * check_in_time <= shift_start -> `is_late = False`, status = `PRESENT`.
    2. Detection within cooldown period (default 5 minutes):
       - Suppressed as duplicate (`AttendanceEventResultEnum.COOLDOWN_IGNORED`).
       - No database modification.
    3. Detection after cooldown period:
       - Registers as 'Check-Out' (`AttendanceEventResultEnum.CHECKED_OUT`).
       - Updates `check_out_time` to detection timestamp.
       - Computes `total_hours = (check_out - check_in).total_seconds() / 3600.0`.
    """
    if timestamp is None:
        timestamp = datetime.now()

    # Resolve Employee
    user: Optional[User] = None
    if isinstance(employee_id, int) or (isinstance(employee_id, str) and employee_id.isdigit()):
        user = db.query(User).filter(User.id == int(employee_id)).first()

    if user is None:
        user = db.query(User).filter(User.employee_id == str(employee_id)).first()

    if user is None:
        raise ValueError(f"Employee with identifier '{employee_id}' not found.")

    target_date = timestamp.date()
    effective_cooldown = (
        cooldown_minutes if cooldown_minutes is not None else settings.COOLDOWN_MINUTES
    )
    cooldown_seconds = effective_cooldown * 60

    # Query for existing daily log
    existing_log: Optional[AttendanceLog] = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == target_date)
        .first()
    )

    if existing_log is None:
        # First daily detection -> CHECK-IN
        shift_cutoff = _parse_shift_time(user.shift_start)
        check_in_time_val = timestamp.time()
        is_late = check_in_time_val > shift_cutoff
        status = AttendanceStatusEnum.LATE.value if is_late else AttendanceStatusEnum.PRESENT.value

        new_log = AttendanceLog(
            user_id=user.id,
            date=target_date,
            check_in_time=timestamp,
            check_out_time=None,
            total_hours=None,
            status=status,
            is_late=is_late,
            source=source,
            notes=notes,
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)

        return AttendanceResult(
            event_result=AttendanceEventResultEnum.CHECKED_IN,
            message=f"Checked In at {timestamp.strftime('%H:%M:%S')}. Status: {status}",
            status=status,
            is_late=is_late,
            check_in_time=new_log.check_in_time,
            check_out_time=None,
            total_hours=None,
            duration_hours=None,
            employee_id=user.employee_id,
            full_name=user.full_name,
        )

    # Existing daily record found -> check if employee already checked out for today
    if existing_log.check_out_time is not None:
        # Employee already completed their checkout for the day. Lock the checkout time
        # to prevent subsequent kiosk camera passes from overwriting duration.
        out_time_str = existing_log.check_out_time.strftime("%H:%M:%S")
        hours_str = (
            f"{existing_log.total_hours:.2f}"
            if existing_log.total_hours is not None
            else "0.00"
        )
        return AttendanceResult(
            event_result=AttendanceEventResultEnum.COOLDOWN_IGNORED,
            message=f"Already Checked Out today at {out_time_str} ({hours_str} hrs). Checkout locked.",
            status=existing_log.status,
            is_late=existing_log.is_late,
            check_in_time=existing_log.check_in_time,
            check_out_time=existing_log.check_out_time,
            total_hours=existing_log.total_hours,
            duration_hours=existing_log.total_hours,
            employee_id=user.employee_id,
            full_name=user.full_name,
        )

    # Not yet checked out -> check cooldown against check_in_time
    delta_from_check_in = (timestamp - existing_log.check_in_time).total_seconds()

    if 0 <= delta_from_check_in < cooldown_seconds:
        # Within cooldown window from check-in -> COOLDOWN_IGNORED
        return AttendanceResult(
            event_result=AttendanceEventResultEnum.COOLDOWN_IGNORED,
            message=f"Detection within {effective_cooldown}-minute cooldown window ignored.",
            status=existing_log.status,
            is_late=existing_log.is_late,
            check_in_time=existing_log.check_in_time,
            check_out_time=existing_log.check_out_time,
            total_hours=existing_log.total_hours,
            duration_hours=existing_log.total_hours,
            employee_id=user.employee_id,
            full_name=user.full_name,
        )

    # Outside cooldown window -> Record CHECK-OUT
    existing_log.check_out_time = timestamp
    duration_seconds = (timestamp - existing_log.check_in_time).total_seconds()
    calculated_hours = round(max(0.0, duration_seconds / 3600.0), 2)
    existing_log.total_hours = calculated_hours
    existing_log.source = source
    if notes:
        existing_log.notes = (
            f"{existing_log.notes}; {notes}" if existing_log.notes else notes
        )
    existing_log.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(existing_log)

    return AttendanceResult(
        event_result=AttendanceEventResultEnum.CHECKED_OUT,
        message=f"Checked Out at {timestamp.strftime('%H:%M:%S')}. Total Hours: {calculated_hours:.2f} hrs",
        status=existing_log.status,
        is_late=existing_log.is_late,
        check_in_time=existing_log.check_in_time,
        check_out_time=existing_log.check_out_time,
        total_hours=calculated_hours,
        duration_hours=calculated_hours,
        employee_id=user.employee_id,
        full_name=user.full_name,
    )


def get_daily_summary(db: Session, target_date: date) -> DailySummaryResponse:
    """Compute aggregate attendance metrics for a specific date.

    Returns:
    - total_employees: count of all active employees.
    - present_count: count of employees with check-in records.
    - late_count: count of check-ins marked as late.
    - absent_count: total_employees - present_count.
    - attendance_rate: percentage of enrolled employees present (0.0 to 100.0).
    - department_stats: department-level breakdown.
    """
    total_active_employees = (
        db.query(User).filter(User.is_active.is_(True)).count()
    )

    logs = (
        db.query(AttendanceLog)
        .join(User, AttendanceLog.user_id == User.id)
        .filter(AttendanceLog.date == target_date, User.is_active.is_(True))
        .all()
    )

    present_count = len(logs)
    late_count = sum(1 for log in logs if log.is_late or log.status == AttendanceStatusEnum.LATE.value)
    absent_count = max(0, total_active_employees - present_count)
    attendance_rate = (
        round((present_count / total_active_employees * 100.0), 1)
        if total_active_employees > 0
        else 0.0
    )

    # Department-level statistics
    departments = db.query(Department).all()
    dept_stats: List[DepartmentSummary] = []

    for dept in departments:
        dept_users = (
            db.query(User)
            .filter(User.department_id == dept.id, User.is_active.is_(True))
            .all()
        )
        dept_total = len(dept_users)
        dept_user_ids = {u.id for u in dept_users}
        dept_logs = [l for l in logs if l.user_id in dept_user_ids]

        dept_present = len(dept_logs)
        dept_late = sum(
            1 for l in dept_logs if l.is_late or l.status == AttendanceStatusEnum.LATE.value
        )
        dept_absent = max(0, dept_total - dept_present)
        dept_rate = (
            round((dept_present / dept_total * 100.0), 1) if dept_total > 0 else 0.0
        )

        dept_stats.append(
            DepartmentSummary(
                department_id=dept.id,
                department_name=dept.name,
                department_code=dept.code,
                total_employees=dept_total,
                present_count=dept_present,
                late_count=dept_late,
                absent_count=dept_absent,
                attendance_rate=dept_rate,
            )
        )

    return DailySummaryResponse(
        date=target_date,
        total_employees=total_active_employees,
        present_count=present_count,
        late_count=late_count,
        absent_count=absent_count,
        attendance_rate=attendance_rate,
        department_stats=dept_stats,
    )


def get_employee_status(
    db: Session,
    employee_id: Union[str, int],
    target_date: Optional[date] = None,
) -> CheckInStatusResponse:
    """Retrieve real-time check-in/out status for a specific employee."""
    if target_date is None:
        target_date = datetime.now().date()

    user: Optional[User] = None
    if isinstance(employee_id, int) or (isinstance(employee_id, str) and employee_id.isdigit()):
        user = db.query(User).filter(User.id == int(employee_id)).first()

    if user is None:
        user = db.query(User).filter(User.employee_id == str(employee_id)).first()

    if user is None:
        raise ValueError(f"Employee with ID '{employee_id}' not found.")

    log = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == target_date)
        .first()
    )

    if log is not None:
        return CheckInStatusResponse(
            employee_id=user.employee_id,
            full_name=user.full_name,
            date=target_date,
            is_checked_in=True,
            is_checked_out=log.check_out_time is not None,
            check_in_time=log.check_in_time,
            check_out_time=log.check_out_time,
            total_hours=log.total_hours,
            status=log.status,
            is_late=log.is_late,
        )

    return CheckInStatusResponse(
        employee_id=user.employee_id,
        full_name=user.full_name,
        date=target_date,
        is_checked_in=False,
        is_checked_out=False,
        check_in_time=None,
        check_out_time=None,
        total_hours=None,
        status="NOT_CHECKED_IN",
        is_late=False,
    )


def mark_manual_attendance(
    db: Session,
    employee_id: Union[str, int],
    target_date: date,
    check_in_time: datetime,
    check_out_time: Optional[datetime] = None,
    status: Optional[str] = None,
    is_late: Optional[bool] = None,
    notes: Optional[str] = None,
) -> AttendanceLog:
    """Manually create or override an employee's attendance record (for HR/Admin)."""
    user: Optional[User] = None
    if isinstance(employee_id, int) or (isinstance(employee_id, str) and employee_id.isdigit()):
        user = db.query(User).filter(User.id == int(employee_id)).first()

    if user is None:
        user = db.query(User).filter(User.employee_id == str(employee_id)).first()

    if user is None:
        raise ValueError(f"Employee with ID '{employee_id}' not found.")

    shift_cutoff = _parse_shift_time(user.shift_start)
    if is_late is None:
        is_late = check_in_time.time() > shift_cutoff

    if status is None:
        status = AttendanceStatusEnum.LATE.value if is_late else AttendanceStatusEnum.PRESENT.value

    total_hours = None
    if check_out_time is not None:
        total_hours = round(
            max(0.0, (check_out_time - check_in_time).total_seconds() / 3600.0), 2
        )

    existing = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == target_date)
        .first()
    )

    if existing is not None:
        existing.check_in_time = check_in_time
        existing.check_out_time = check_out_time
        existing.total_hours = total_hours
        existing.status = status
        existing.is_late = is_late
        existing.source = "MANUAL"
        existing.notes = notes
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    new_log = AttendanceLog(
        user_id=user.id,
        date=target_date,
        check_in_time=check_in_time,
        check_out_time=check_out_time,
        total_hours=total_hours,
        status=status,
        is_late=is_late,
        source="MANUAL",
        notes=notes,
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log
