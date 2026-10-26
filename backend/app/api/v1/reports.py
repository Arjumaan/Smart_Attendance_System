"""Attendance Reporting and Export API endpoints."""

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.core.security import CurrentUser
from backend.app.schemas.reports import ReportFilterParams
from backend.app.services.reports import generate_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/export")
def export_report_get(
    format: str = Query("csv", description="Export format: csv, xlsx, or pdf"),
    start_date: Optional[date] = Query(None, description="Start date (defaults to 30 days ago)"),
    end_date: Optional[date] = Query(None, description="End date (defaults to today)"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    status: Optional[str] = Query(None, description="Filter by status (PRESENT, LATE, etc.)"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Export attendance audit report in CSV, Excel (.xlsx), or PDF format via GET query parameters."""
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    content, media_type, filename = generate_report(
        db=db,
        start_date=s_date,
        end_date=e_date,
        department_id=department_id,
        employee_id=employee_id,
        status=status,
        report_format=format,
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/export")
def export_report_post(
    filters: ReportFilterParams,
    format: str = Query("csv", description="Export format: csv, xlsx, or pdf"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Export attendance audit report via POST request body."""
    content, media_type, filename = generate_report(
        db=db,
        start_date=filters.start_date,
        end_date=filters.end_date,
        department_id=filters.department_id,
        employee_id=filters.employee_id,
        status=filters.status,
        report_format=format,
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
