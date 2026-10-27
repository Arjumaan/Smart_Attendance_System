"""API dependencies for database access, authentication, and RBAC authorization."""

from typing import Callable, Generator, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.security import (
    CurrentUser,
    UserRole,
    get_current_user,
    get_optional_current_user,
    require_roles,
)
from backend.app.db.session import get_db

# Role authorization convenience dependencies
require_admin: Callable[..., CurrentUser] = require_roles(UserRole.ADMIN)
require_hr_or_admin: Callable[..., CurrentUser] = require_roles(UserRole.ADMIN, UserRole.HR)
require_manager_or_higher: Callable[..., CurrentUser] = require_roles(
    UserRole.ADMIN, UserRole.HR, UserRole.MANAGER
)


def get_current_active_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Ensure the authenticated user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive employee account.",
        )
    return current_user


__all__ = [
    "get_db",
    "get_current_user",
    "get_optional_current_user",
    "get_current_active_user",
    "require_roles",
    "require_admin",
    "require_hr_or_admin",
    "require_manager_or_higher",
]
