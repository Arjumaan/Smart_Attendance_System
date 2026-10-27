"""LeaveRequest SQLAlchemy ORM model for employee leaves and permissions."""

from datetime import date, datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base

if TYPE_CHECKING:
    from backend.app.models.user import User


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    request_type: Mapped[str] = mapped_column(String(20), default="LEAVE", nullable=False)  # LEAVE, PERMISSION
    leave_type: Mapped[str] = mapped_column(String(30), default="CASUAL", nullable=False)  # CASUAL, SICK, ANNUAL, EMERGENCY, PERMISSION_EARLY_EXIT, etc.
    start_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    start_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # e.g., "14:00" for permissions
    end_time: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)    # e.g., "16:00"
    duration_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # for permissions or partial days
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", index=True, nullable=False)  # PENDING, APPROVED, REJECTED, ENQUIRY_REQUESTED
    reviewer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    employee_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        backref="leave_requests",
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[reviewer_id],
    )
