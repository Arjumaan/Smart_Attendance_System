"""User and Department Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from backend.app.core.security import UserRole


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
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None
    shift_start: Optional[str] = None
    password: Optional[str] = None


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
