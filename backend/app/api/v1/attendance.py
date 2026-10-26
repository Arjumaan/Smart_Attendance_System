"""Attendance Records and Management API endpoints."""

from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db, require_hr_or_admin
from backend.app.core.security import CurrentUser
from backend.app.models.attendance import AttendanceLog
from backend.app.models.user import User
from backend.app.schemas.attendance import (
    AttendanceEventRequest,
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
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve filtered attendance records with pagination."""
    query = (
        db.query(AttendanceLog)
        .join(User, AttendanceLog.user_id == User.id)
        .options(joinedload(AttendanceLog.user).joinedload(User.department))
    )

    if start_date:
        query = query.filter(AttendanceLog.date >= start_date)
    if end_date:
        query = query.filter(AttendanceLog.date <= end_date)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if employee_id:
        query = query.filter(User.employee_id == employee_id.strip())
    if status:
        query = query.filter(AttendanceLog.status == status.strip().upper())

    records = (
        query.order_by(AttendanceLog.date.desc(), AttendanceLog.check_in_time.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [_format_log_out(r) for r in records]


@router.get("/summary", response_model=DailySummaryResponse)
@router.get("/stats", response_model=DailySummaryResponse)
def get_dashboard_summary(
    target_date: Optional[date] = Query(None, description="Target date (defaults to today)"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Compute enterprise daily attendance KPIs and department breakdown."""
    date_val = target_date or datetime.now().date()
    return get_daily_summary(db=db, target_date=date_val)


@router.get("/status/{employee_id}", response_model=CheckInStatusResponse)
def get_status_for_employee(
    employee_id: str,
    target_date: Optional[date] = Query(None, description="Date (defaults to today)"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
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
