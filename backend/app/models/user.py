"""User SQLAlchemy ORM model."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.security import UserRole
from backend.app.db.base import Base

if TYPE_CHECKING:
    from backend.app.models.attendance import AttendanceLog
    from backend.app.models.department import Department
    from backend.app.models.face_embedding import FaceEmbedding


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=UserRole.EMPLOYEE.value, nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    shift_start: Mapped[str] = mapped_column(String(10), default="09:15", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    department: Mapped[Optional["Department"]] = relationship(
        "Department",
        back_populates="users",
    )
    face_embedding: Mapped[Optional["FaceEmbedding"]] = relationship(
        "FaceEmbedding",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    attendance_logs: Mapped[List["AttendanceLog"]] = relationship(
        "AttendanceLog",
        back_populates="user",
        cascade="all, delete-orphan",
    )
