"""User and Department Pydantic schemas."""

from datetime import datetime
import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from backend.app.core.security import UserRole


def validate_password_complexity(v: str) -> str:
    """Validate enterprise password policy: >=8 chars, uppercase, lowercase, digit, special char."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter (A-Z).")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter (a-z).")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one digit (0-9).")
    if not re.search(r"[^A-Za-z0-9]", v):
        raise ValueError("Password must contain at least one special character.")
    return v


class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=20)
    description: Optional[str] = Field(None, max_length=255)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    employee_id: str = Field(..., max_length=50)
    full_name: str = Field(..., max_length=100)
    email: EmailStr
    role: str = Field(default=UserRole.EMPLOYEE.value)
    department_id: Optional[int] = None
    is_active: bool = True
    shift_start: str = Field(default="09:15", max_length=10)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def check_password_complexity(cls, v: str) -> str:
        return validate_password_complexity(v)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    shift_start: Optional[str] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def check_password_complexity(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_password_complexity(v)
        return v


class UserOut(UserBase):
    id: int
    created_at: datetime
    department: Optional[DepartmentOut] = None
    has_face_enrolled: bool = False

    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    employee_id: str
    user_id: int
    full_name: str


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None
    employee_id: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
