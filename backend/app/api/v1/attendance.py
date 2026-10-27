"""Attendance Records and Management API endpoints."""

from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import (
    get_current_user,
    get_db,
    get_optional_current_user,
    require_hr_or_admin,
)
from backend.app.core.security import CurrentUser
from backend.app.models.attendance import AttendanceLog
from backend.app.models.user import User
from backend.app.schemas.attendance import (
    AttendanceEventRequest,
    AttendanceEventResultEnum,
    AttendanceLogOut,
    AttendanceResult,
    CheckInStatusResponse,
    DailySummaryResponse,
    ManualAttendanceCreate,
)
from backend.app.services.attendance_service import (
    get_daily_summary,
    get_employee_status,
    mark_manual_attendance,
    record_attendance_event,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


def _format_log_out(log: AttendanceLog) -> AttendanceLogOut:
    """Format AttendanceLog model into AttendanceLogOut with user and dept info."""
    emp_id = None
    name = None
    dept_name = None
    if log.user:
        emp_id = log.user.employee_id
        name = log.user.full_name
        if log.user.department:
            dept_name = log.user.department.name

    return AttendanceLogOut(
        id=log.id,
        user_id=log.user_id,
        employee_id=emp_id,
        full_name=name,
        department_name=dept_name,
        date=log.date,
        check_in_time=log.check_in_time,
        check_out_time=log.check_out_time,
        total_hours=log.total_hours,
        status=log.status,
        is_late=log.is_late,
        source=log.source,
        notes=log.notes,
        created_at=log.created_at,
        updated_at=log.updated_at,
    )


@router.get("/logs", response_model=List[AttendanceLogOut])
def get_attendance_logs(
    start_date: Optional[date] = Query(None, description="Start date for log query"),
    end_date: Optional[date] = Query(None, description="End date for log query"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    status: Optional[str] = Query(None, description="Filter by status (PRESENT, LATE, etc.)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    """Retrieve filtered attendance records with pagination."""
    limit_val = limit if isinstance(limit, int) else 100
    offset_val = offset if isinstance(offset, int) else 0
    query = (
        db.query(AttendanceLog)
        .join(User, AttendanceLog.user_id == User.id)
        .options(joinedload(AttendanceLog.user).joinedload(User.department))
    )

    if isinstance(start_date, date):
        query = query.filter(AttendanceLog.date >= start_date)
    if isinstance(end_date, date):
        query = query.filter(AttendanceLog.date <= end_date)
    if isinstance(department_id, int):
        query = query.filter(User.department_id == department_id)
    if isinstance(employee_id, str) and employee_id.strip():
        term = f"%{employee_id.strip()}%"
        query = query.filter(
            or_(
                User.employee_id.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )

    if isinstance(status, str) and status.strip():
        stat_upper = status.strip().upper()
        if stat_upper == "LATE":
            query = query.filter(
                or_(
                    AttendanceLog.status == "LATE",
                    AttendanceLog.is_late.is_(True),
                )
            )
        elif stat_upper == "PRESENT":
            query = query.filter(
                AttendanceLog.status == "PRESENT",
                AttendanceLog.is_late.is_(False),
            )
        elif stat_upper == "ABSENT":
            # For absentees, return active employees who have no record in the specified date range (or today)
            target_date = end_date or start_date or date.today()
            active_q = (
                db.query(User)
                .options(joinedload(User.department))
                .filter(User.is_active.is_(True))
            )
            if isinstance(department_id, int):
                active_q = active_q.filter(User.department_id == department_id)
            if isinstance(employee_id, str) and employee_id.strip():
                clean_term = f"%{employee_id.strip()}%"
                active_q = active_q.filter(
                    or_(
                        User.employee_id.ilike(clean_term),
                        User.full_name.ilike(clean_term),
                        User.email.ilike(clean_term),
                    )
                )

            logged_uids = {
                uid
                for (uid,) in db.query(AttendanceLog.user_id)
                .filter(AttendanceLog.date == target_date)
                .all()
            }

            absent_users = [u for u in active_q.all() if u.id not in logged_uids]
            now_dt = datetime.now()
            return [
                AttendanceLogOut(
                    id=-u.id,
                    user_id=u.id,
                    employee_id=u.employee_id,
                    full_name=u.full_name,
                    department_name=u.department.name if u.department else "Unassigned",
                    date=target_date,
                    check_in_time=None,
                    check_out_time=None,
                    total_hours=0.0,
                    status="ABSENT",
                    is_late=False,
                    source="SYSTEM",
                    notes="No biometric check-in recorded for this date.",
                    created_at=now_dt,
                    updated_at=now_dt,
                )
                for u in absent_users[offset_val : offset_val + limit_val]
            ]
        else:
            query = query.filter(AttendanceLog.status == stat_upper)

    records = (
        query.order_by(AttendanceLog.date.desc(), AttendanceLog.check_in_time.desc())
        .offset(offset_val)
        .limit(limit_val)
        .all()
    )

    return [_format_log_out(r) for r in records]


@router.get("/live-feed", response_model=List[AttendanceResult])
@router.get("/events/today", response_model=List[AttendanceResult])
def get_today_presence_feed(
    target_date: Optional[date] = Query(None, description="Date for presence feed (defaults to today)"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve chronological presence activity feed for the current day.
    
    Persists across server restarts and page refreshes; starts newly on each new calendar day.
    """
    today_val = target_date if isinstance(target_date, date) else date.today()
    limit_val = limit if isinstance(limit, int) else 50

    logs = (
        db.query(AttendanceLog)
        .join(User, AttendanceLog.user_id == User.id)
        .options(joinedload(AttendanceLog.user))
        .filter(AttendanceLog.date == today_val)
        .all()
    )

    events: List[AttendanceResult] = []
    for log in logs:
        emp_id = log.user.employee_id if log.user else "N/A"
        full_name = log.user.full_name if log.user else "Unknown Employee"

        if log.check_out_time:
            time_str = log.check_out_time.strftime("%H:%M:%S")
            hours_str = f" ({log.total_hours:.1f} hrs)" if log.total_hours else ""
            events.append(
                AttendanceResult(
                    event_result=AttendanceEventResultEnum.CHECKED_OUT,
                    message=f"Checked Out at {time_str}{hours_str}",
                    status=log.status,
                    is_late=log.is_late,
                    check_in_time=log.check_in_time,
                    check_out_time=log.check_out_time,
                    total_hours=log.total_hours,
                    duration_hours=log.total_hours,
                    employee_id=emp_id,
                    full_name=full_name,
                )
            )

        if log.check_in_time:
            time_str = log.check_in_time.strftime("%H:%M:%S")
            late_msg = " (Late)" if log.is_late else ""
            events.append(
                AttendanceResult(
                    event_result=AttendanceEventResultEnum.CHECKED_IN,
                    message=f"Checked In at {time_str}{late_msg}. Status: {log.status}",
                    status=log.status,
                    is_late=log.is_late,
                    check_in_time=log.check_in_time,
                    check_out_time=None,
                    total_hours=None,
                    duration_hours=None,
                    employee_id=emp_id,
                    full_name=full_name,
                )
            )

    def _get_sort_time(e: AttendanceResult):
        if e.event_result == AttendanceEventResultEnum.CHECKED_OUT:
            return e.check_out_time or datetime.min
        return e.check_in_time or datetime.min

    events.sort(key=_get_sort_time, reverse=True)
    return events[:limit_val]


@router.get("/summary", response_model=DailySummaryResponse)
@router.get("/stats", response_model=DailySummaryResponse)
@router.get("/stats/dashboard", response_model=DailySummaryResponse)
def get_dashboard_summary(
    target_date: Optional[date] = Query(None, description="Target date (defaults to today)"),
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    """Compute enterprise daily attendance KPIs and department breakdown."""
    date_val = target_date or datetime.now().date()
    return get_daily_summary(db=db, target_date=date_val)


@router.get("/status/{employee_id}", response_model=CheckInStatusResponse)
def get_status_for_employee(
    employee_id: str,
    target_date: Optional[date] = Query(None, description="Date (defaults to today)"),
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    """Get real-time check-in and checkout status for a specific employee."""
    try:
        date_val = target_date or datetime.now().date()
        return get_employee_status(db=db, employee_id=employee_id, target_date=date_val)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/events", response_model=AttendanceResult)
def trigger_attendance_event(
    event_req: AttendanceEventRequest,
    db: Session = Depends(get_db),
):
    """Record an attendance event directly (from Kiosk or Edge CCTV runner)."""
    try:
        res = record_attendance_event(
            db=db,
            employee_id=event_req.employee_id,
            timestamp=event_req.timestamp,
            source=event_req.source,
        )
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/mark", response_model=AttendanceLogOut)
def manual_attendance_mark(
    manual_in: ManualAttendanceCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Manually insert or override an attendance log (HR/Admin only)."""
    try:
        log = mark_manual_attendance(
            db=db,
            employee_id=manual_in.employee_id,
            target_date=manual_in.date,
            check_in_time=manual_in.check_in_time,
            check_out_time=manual_in.check_out_time,
            status=manual_in.status,
            is_late=manual_in.is_late,
            notes=manual_in.notes,
        )
        # Reload relationships
        refreshed = (
            db.query(AttendanceLog)
            .options(joinedload(AttendanceLog.user).joinedload(User.department))
            .filter(AttendanceLog.id == log.id)
            .first()
        )
        return _format_log_out(refreshed or log)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
