"""Pydantic schemas exports."""

from backend.app.schemas.attendance import (
    AttendanceEventRequest,
    AttendanceEventResultEnum,
    AttendanceLogOut,
    AttendanceResult,
    AttendanceStatusEnum,
    DailyStats,
)
from backend.app.schemas.biometrics import (
    BiometricEnrollRequest,
    BiometricMatchResult,
    BiometricVerifyRequest,
    FaceEmbeddingOut,
)
from backend.app.schemas.reports import (
    ReportFilterParams,
    ReportRecord,
    ReportResponse,
)
from backend.app.schemas.user import (
    DepartmentCreate,
    DepartmentOut,
    Token,
    TokenPayload,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)

__all__ = [
    "UserCreate",
    "UserUpdate",
    "UserOut",
    "UserLogin",
    "DepartmentCreate",
    "DepartmentOut",
    "Token",
    "TokenPayload",
    "BiometricEnrollRequest",
    "BiometricVerifyRequest",
    "BiometricMatchResult",
    "FaceEmbeddingOut",
    "AttendanceEventRequest",
    "AttendanceLogOut",
    "AttendanceResult",
    "DailyStats",
    "AttendanceStatusEnum",
    "AttendanceEventResultEnum",
    "ReportFilterParams",
    "ReportRecord",
    "ReportResponse",
]
