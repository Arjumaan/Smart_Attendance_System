"""Security, Authentication, and Role-Based Access Control (RBAC) module."""

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from pydantic import BaseModel, ConfigDict

from backend.app.core.config import settings


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    HR = "HR"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"


class CurrentUser(BaseModel):
    id: int
    employee_id: str
    email: str
    full_name: str
    role: str
    is_active: bool = True
    department_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# HTTP Bearer scheme
bearer_scheme = HTTPBearer(auto_error=False)


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt with random salt."""
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")
    # Ensure byte representation
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    subject: Union[str, int],
    role: Union[UserRole, str],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    role_str = role.value if isinstance(role, UserRole) else str(role)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "role": role_str,
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
    }

    if extra_claims:
        payload.update(extra_claims)

    encoded_jwt = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token signature has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    """Dependency to retrieve and validate the authenticated user from bearer token."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    sub = payload.get("sub")
    role = payload.get("role")

    if sub is None or role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims: missing subject or role.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reconstruct CurrentUser from token payload
    user = CurrentUser(
        id=int(sub) if str(sub).isdigit() else 1,
        employee_id=str(payload.get("employee_id", f"EMP-{sub}")),
        email=str(payload.get("email", f"user-{sub}@enterprise.local")),
        full_name=str(payload.get("full_name", f"User {sub}")),
        role=role,
        is_active=bool(payload.get("is_active", True)),
        department_id=payload.get("department_id"),
    )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account.",
        )

    return user


def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[CurrentUser]:
    """Dependency to retrieve user from token if provided, returning None if unauthenticated."""
    if not auth or not auth.credentials:
        return None
    try:
        payload = decode_access_token(auth.credentials)
        sub = payload.get("sub")
        role = payload.get("role")
        if sub is None or role is None:
            return None
        return CurrentUser(
            id=int(sub) if str(sub).isdigit() else 1,
            employee_id=str(payload.get("employee_id", f"EMP-{sub}")),
            email=str(payload.get("email", f"user-{sub}@enterprise.local")),
            full_name=str(payload.get("full_name", f"User {sub}")),
            role=str(role),
            is_active=bool(payload.get("is_active", True)),
            department_id=payload.get("department_id"),
        )
    except Exception:
        return None


def require_roles(*allowed_roles: Union[UserRole, str]) -> Callable[..., CurrentUser]:
    """Factory dependency to enforce Role-Based Access Control (RBAC).

    Raises HTTP 403 Forbidden if the authenticated user's role is not permitted.
    """
    normalized_allowed: List[str] = [
        r.value if isinstance(r, UserRole) else str(r) for r in allowed_roles
    ]

    def role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current_user.role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: role '{current_user.role}' lacks permission for this endpoint.",
            )
        return current_user

    return role_checker
