"""Attendance logs and event processing Pydantic schemas."""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AttendanceStatusEnum(str, Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"
    HALF_DAY = "HALF_DAY"
    ABSENT = "ABSENT"


class AttendanceEventResultEnum(str, Enum):
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    COOLDOWN_IGNORED = "COOLDOWN_IGNORED"
    UNRECOGNIZED = "UNRECOGNIZED"


class AttendanceEventRequest(BaseModel):
    employee_id: str
    timestamp: Optional[datetime] = None
    source: str = Field(default="KIOSK")  # KIOSK, CCTV, MANUAL


class AttendanceResult(BaseModel):
    event_result: AttendanceEventResultEnum
    message: str
    status: str
    is_late: bool
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    total_hours: Optional[float] = None
    duration_hours: Optional[float] = None
    employee_id: str
    full_name: str


class AttendanceLogOut(BaseModel):
    id: int
    user_id: int
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    department_name: Optional[str] = None
    date: date
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    total_hours: Optional[float] = None
    status: str
    is_late: bool
    source: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DepartmentSummary(BaseModel):
    department_id: Optional[int] = None
    department_name: str
    department_code: str
    total_employees: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float


class DailySummaryResponse(BaseModel):
    date: date
    total_employees: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float
    department_stats: list[DepartmentSummary] = []


# Alias for backward-compatibility with DailyStats
class DailyStats(BaseModel):
    date: date
    total_enrolled: int
    present_count: int
    late_count: int
    absent_count: int
    attendance_rate: float


class CheckInStatusResponse(BaseModel):
    employee_id: str
    full_name: str
    date: date
    is_checked_in: bool
    is_checked_out: bool
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    total_hours: Optional[float] = None
    status: str
    is_late: bool


class ManualAttendanceCreate(BaseModel):
    employee_id: str
    date: date
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    status: Optional[str] = None
    is_late: Optional[bool] = None
    notes: Optional[str] = None

