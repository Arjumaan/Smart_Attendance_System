"""Core application modules: configuration, cryptography, and security."""

from backend.app.core.config import settings
from backend.app.core.encryption import (
    decrypt_embedding,
    encrypt_embedding,
    generate_encryption_key,
    is_ciphertext,
)
from backend.app.core.security import (
    CurrentUser,
    UserRole,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_password_hash,
    require_roles,
    verify_password,
)

__all__ = [
    "settings",
    "encrypt_embedding",
    "decrypt_embedding",
    "is_ciphertext",
    "generate_encryption_key",
    "CurrentUser",
    "UserRole",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_password_hash",
    "verify_password",
    "require_roles",
]
