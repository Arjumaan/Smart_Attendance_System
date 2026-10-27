"""Authentication endpoints: Login and Me."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.core.security import CurrentUser, create_access_token, verify_password
from backend.app.models.user import User
from backend.app.schemas.user import Token, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
@router.post("/token", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with corporate email or employee ID and password, returning JWT access token."""
    identifier_clean = credentials.email.strip().lower()
    user = (
        db.query(User)
        .filter(
            (func.lower(User.email) == identifier_clean)
            | (func.lower(User.employee_id) == identifier_clean)
        )
        .first()
    )
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email / employee ID or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee account is inactive.",
        )

    extra_claims = {
        "employee_id": user.employee_id,
        "email": user.email,
        "full_name": user.full_name,
        "department_id": user.department_id,
        "is_active": user.is_active,
    }
    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        extra_claims=extra_claims,
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        employee_id=user.employee_id,
        user_id=user.id,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get profile information for the authenticated user."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    has_face = user.face_embedding is not None
    user_out = UserOut.model_validate(user)
    user_out.has_face_enrolled = has_face
    return user_out
