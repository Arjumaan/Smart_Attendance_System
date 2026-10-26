"""Attendance reporting and export Pydantic schemas."""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ReportFilterParams(BaseModel):
    start_date: date
    end_date: date
    department_id: Optional[int] = None
    employee_id: Optional[str] = None
    status: Optional[str] = None


class ReportRecord(BaseModel):
    date: str
    employee_id: str
    full_name: str
    department: str
    check_in_time: str
    check_out_time: Optional[str] = None
    total_hours: Optional[float] = None
    status: str
    is_late: bool


class ReportResponse(BaseModel):
    total_records: int
    generated_at: datetime
    records: List[ReportRecord]
