"""Leave and Permission Request Pydantic Schemas."""

from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class RequestTypeEnum(str, Enum):
    LEAVE = "LEAVE"
    PERMISSION = "PERMISSION"


class LeaveTypeEnum(str, Enum):
    CASUAL = "CASUAL"
    SICK = "SICK"
    ANNUAL = "ANNUAL"
    EMERGENCY = "EMERGENCY"
    PERMISSION_EARLY_EXIT = "PERMISSION_EARLY_EXIT"
    PERMISSION_LATE_ENTRY = "PERMISSION_LATE_ENTRY"
    PERMISSION_OFFICIAL = "PERMISSION_OFFICIAL"


class LeaveStatusEnum(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ENQUIRY_REQUESTED = "ENQUIRY_REQUESTED"
    CANCELLED = "CANCELLED"


class LeaveActionEnum(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ENQUIRE = "ENQUIRE"


class LeaveCreate(BaseModel):
    request_type: str = Field(default="LEAVE", description="'LEAVE' or 'PERMISSION'")
    leave_type: str = Field(default="CASUAL", description="Type of leave or permission")
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[str] = Field(None, description="e.g. '14:00' for permissions")
    end_time: Optional[str] = Field(None, description="e.g. '16:00' for permissions")
    duration_hours: Optional[float] = Field(None, description="Duration in hours for permission or partial days")
    reason: str = Field(..., min_length=3, max_length=1000, description="Reason for request")


class LeaveReviewAction(BaseModel):
    action: LeaveActionEnum = Field(..., description="APPROVE, REJECT, or ENQUIRE")
    notes: Optional[str] = Field(None, description="Admin review notes, rejection reason, or enquiry question")
    admin_notes: Optional[str] = Field(None, description="Alias for notes")


class LeaveEnquiryReply(BaseModel):
    reply: str = Field(..., min_length=2, max_length=1000, description="Employee response to admin enquiry")


class LeaveOut(BaseModel):
    id: int
    user_id: int
    employee_id: str
    full_name: str
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    request_type: str
    leave_type: str
    start_date: date
    end_date: date
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_hours: Optional[float] = None
    reason: str
    status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    admin_notes: Optional[str] = None
    employee_reply: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
