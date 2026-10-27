"""Employees CRUD API endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import (
    get_current_user,
    get_db,
    get_optional_current_user,
    require_admin,
    require_hr_or_admin,
)
from backend.app.core.security import CurrentUser, get_password_hash
from backend.app.models.department import Department
from backend.app.models.user import User
from backend.app.schemas.user import UserCreate, UserOut, UserUpdate
from backend.app.services.face_engine import default_cache

router = APIRouter(prefix="/employees", tags=["Employees"])


def _format_user_out(user: User) -> UserOut:
    """Helper to convert User model into UserOut with has_face_enrolled."""
    out = UserOut.model_validate(user)
    out.has_face_enrolled = user.face_embedding is not None
    return out


@router.get("/", response_model=List[UserOut])
def list_employees(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    search: Optional[str] = Query(None, description="Search by name, email, or employee ID"),
    is_active: Optional[bool] = Query(None, description="Filter active/inactive"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
):
    """List corporate employees with optional filtering and pagination."""
    query = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.face_embedding))
    )

    if department_id:
        query = query.filter(User.department_id == department_id)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (User.full_name.ilike(term))
            | (User.email.ilike(term))
            | (User.employee_id.ilike(term))
        )

    users = query.order_by(User.full_name.asc()).offset(offset).limit(limit).all()
    return [_format_user_out(u) for u in users]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Register a new employee into the system (HR/Admin only)."""
    # Check uniqueness
    existing = (
        db.query(User)
        .filter(
            (User.employee_id == user_in.employee_id.strip())
            | (User.email == user_in.email.strip())
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with ID '{user_in.employee_id}' or email '{user_in.email}' already exists.",
        )

    # Validate department if provided
    if user_in.department_id:
        dept = db.query(Department).filter(Department.id == user_in.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department ID {user_in.department_id} not found.",
            )

    new_user = User(
        employee_id=user_in.employee_id.strip(),
        full_name=user_in.full_name.strip(),
        email=user_in.email.strip(),
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        department_id=user_in.department_id,
        is_active=user_in.is_active,
        shift_start=user_in.shift_start or "09:15",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return _format_user_out(new_user)


@router.get("/{user_id}", response_model=UserOut)
def get_employee(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get employee details by user ID or employee ID."""
    user = None
    if user_id.isdigit():
        user = (
            db.query(User)
            .options(joinedload(User.department), joinedload(User.face_embedding))
            .filter(User.id == int(user_id))
            .first()
        )
    if not user:
        user = (
            db.query(User)
            .options(joinedload(User.department), joinedload(User.face_embedding))
            .filter(User.employee_id == user_id)
            .first()
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{user_id}' not found.",
        )

    return _format_user_out(user)


@router.put("/{user_id}", response_model=UserOut)
def update_employee(
    user_id: str,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Update employee details (HR/Admin only)."""
    user = None
    if user_id.isdigit():
        user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        user = db.query(User).filter(User.employee_id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{user_id}' not found.",
        )

    if user_in.email:
        conflict = (
            db.query(User)
            .filter(User.email == user_in.email.strip(), User.id != user.id)
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{user_in.email}' is already in use by another employee.",
            )
        user.email = user_in.email.strip()

    if user_in.full_name is not None:
        user.full_name = user_in.full_name.strip()
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.department_id is not None:
        user.department_id = user_in.department_id
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.shift_start is not None:
        user.shift_start = user_in.shift_start
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)

    db.commit()
    db.refresh(user)

    return _format_user_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_admin),
):
    """Delete an employee and their biometric records (Admin only)."""
    user = None
    if user_id.isdigit():
        user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        user = db.query(User).filter(User.employee_id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{user_id}' not found.",
        )

    # Evict from in-memory cache
    default_cache.remove_embedding(user.id)

    db.delete(user)
    db.commit()
    return None
