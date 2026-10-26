"""Comprehensive security, cryptography, and RBAC test suite for Milestone 1."""

from datetime import date, datetime, timedelta, timezone
import base64
from fastapi import HTTPException, status
import numpy as np
import pytest
from sqlalchemy.exc import IntegrityError

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
    get_password_hash,
    require_roles,
    verify_password,
)
from backend.app.models.attendance import AttendanceLog
from backend.app.models.department import Department
from backend.app.models.face_embedding import FaceEmbedding
from backend.app.models.user import User


# ============================================================================
# 1. Biometric Cryptography & Privacy at Rest Tests
# ============================================================================


def test_biometric_vector_encryption_roundtrip(sample_embedding_512: np.ndarray, test_key: str):
    """Verify that a 512-d float32 vector encrypts to ciphertext and decrypts to identical vector."""
    # Test with default key
    ciphertext_default = encrypt_embedding(sample_embedding_512)
    decrypted_default = decrypt_embedding(ciphertext_default)

    assert isinstance(decrypted_default, np.ndarray)
    assert decrypted_default.shape == (512,)
    assert decrypted_default.dtype == np.float32
    assert np.allclose(sample_embedding_512, decrypted_default, atol=1e-6)

    # Test with custom generated key
    ciphertext_custom = encrypt_embedding(sample_embedding_512, key=test_key)
    decrypted_custom = decrypt_embedding(ciphertext_custom, key=test_key)
    assert np.allclose(sample_embedding_512, decrypted_custom, atol=1e-6)


def test_biometric_ciphertext_properties(sample_embedding_512: np.ndarray):
    """Confirm ciphertext is non-plaintext, randomized per run, and validated by is_ciphertext."""
    ciphertext1 = encrypt_embedding(sample_embedding_512)
    ciphertext2 = encrypt_embedding(sample_embedding_512)

    # Randomized IV/nonce verification: consecutive encryptions of same vector produce different tokens
    assert ciphertext1 != ciphertext2

    # Verify is_ciphertext recognizes legitimate encrypted token
    assert is_ciphertext(ciphertext1) is True
    assert is_ciphertext(ciphertext2) is True

    # Plaintext formats must be rejected by is_ciphertext
    raw_list_str = str(sample_embedding_512.tolist())
    assert is_ciphertext(raw_list_str) is False
    assert is_ciphertext("[0.123, 0.456, -0.789]") is False
    assert is_ciphertext("not_a_valid_token") is False
    assert is_ciphertext("") is False

    # Stored token must NOT contain raw string representation of floats
    assert "0." not in ciphertext1[:50]


def test_biometric_decryption_authentication_failure(sample_embedding_512: np.ndarray):
    """Verify AEAD tag authentication fails upon tampering or incorrect key."""
    key_a = generate_encryption_key()
    key_b = generate_encryption_key()
    ciphertext = encrypt_embedding(sample_embedding_512, key=key_a)

    # 1. Decrypting with wrong key must fail
    with pytest.raises(ValueError, match="Decryption failed"):
        decrypt_embedding(ciphertext, key=key_b)

    # 2. Tampering with ciphertext bits must trigger authentication tag validation failure
    raw_bytes = bytearray(base64.urlsafe_b64decode(ciphertext.encode("ascii")))
    # Flip bits in payload
    raw_bytes[20] ^= 0xFF
    tampered_ciphertext = base64.urlsafe_b64encode(raw_bytes).decode("ascii")

    with pytest.raises(ValueError, match="Decryption failed"):
        decrypt_embedding(tampered_ciphertext, key=key_a)

    # 3. Truncated payload must fail
    truncated_ciphertext = base64.urlsafe_b64encode(raw_bytes[:10]).decode("ascii")
    with pytest.raises(ValueError):
        decrypt_embedding(truncated_ciphertext, key=key_a)


# ============================================================================
# 2. Password Hashing & Bcrypt Verification Tests
# ============================================================================


def test_password_hashing_bcrypt():
    """Verify password hashing with bcrypt, salting, and mismatch detection."""
    password = "SuperEnterprisePassword123!"
    hashed = get_password_hash(password)

    # Hash must be distinct from plaintext
    assert hashed != password
    assert hashed.startswith("$2")

    # Correct password verifies True
    assert verify_password(password, hashed) is True

    # Wrong password verifies False
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False

    # Distinct salts: hashing twice yields different hashes
    hashed_again = get_password_hash(password)
    assert hashed != hashed_again
    assert verify_password(password, hashed_again) is True


# ============================================================================
# 3. JWT Authentication & Lifecycle Tests
# ============================================================================


def test_jwt_token_lifecycle():
    """Verify JWT token creation, claims decoding, expiration, and tampering handling."""
    claims = {
        "employee_id": "EMP007",
        "full_name": "James Bond",
        "email": "jbond@mi6.gov.uk",
        "department_id": 1,
    }
    token = create_access_token(
        subject="7",
        role=UserRole.ADMIN,
        expires_delta=timedelta(minutes=30),
        extra_claims=claims,
    )

    # Decode and verify payload
    payload = decode_access_token(token)
    assert payload["sub"] == "7"
    assert payload["role"] == UserRole.ADMIN.value
    assert payload["employee_id"] == "EMP007"
    assert payload["full_name"] == "James Bond"
    assert payload["exp"] > int(datetime.now(timezone.utc).timestamp())

    # Expired token raises 401
    expired_token = create_access_token(
        subject="7",
        role=UserRole.ADMIN,
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(expired_token)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
    assert "expired" in exc_info.value.detail.lower()

    # Tampered signature raises 401
    parts = token.split(".")
    tampered_token = f"{parts[0]}.{parts[1]}.invalid_signature"
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(tampered_token)
    assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


# ============================================================================
# 4. Role-Based Access Control (RBAC) Tests
# ============================================================================


def test_rbac_require_roles_enforcement():
    """Verify RBAC dependency allows authorized roles and rejects unauthorized with HTTP 403."""
    admin_checker = require_roles(UserRole.ADMIN, UserRole.HR)

    admin_user = CurrentUser(
        id=1,
        employee_id="EMP001",
        email="admin@test.local",
        full_name="Admin User",
        role=UserRole.ADMIN.value,
    )
    hr_user = CurrentUser(
        id=2,
        employee_id="EMP002",
        email="hr@test.local",
        full_name="HR User",
        role=UserRole.HR.value,
    )
    manager_user = CurrentUser(
        id=3,
        employee_id="EMP003",
        email="manager@test.local",
        full_name="Manager User",
        role=UserRole.MANAGER.value,
    )
    employee_user = CurrentUser(
        id=4,
        employee_id="EMP004",
        email="emp@test.local",
        full_name="Staff User",
        role=UserRole.EMPLOYEE.value,
    )

    # Allowed roles pass through cleanly
    assert admin_checker(admin_user) == admin_user
    assert admin_checker(hr_user) == hr_user

    # Unauthorized roles raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        admin_checker(manager_user)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
    assert "Forbidden" in exc_info.value.detail

    with pytest.raises(HTTPException) as exc_info:
        admin_checker(employee_user)
    assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


# ============================================================================
# 5. Database ORM Persistence & Integrity Tests
# ============================================================================


def test_database_models_persistence(db_session, sample_embedding_512: np.ndarray):
    """Verify ORM models persistence, relationship cascades, encrypted embedding storage, and constraints."""
    # 1. Department
    dept = Department(name="Security Operations", code="SEC-OPS", description="Enterprise Security")
    db_session.add(dept)
    db_session.commit()
    db_session.refresh(dept)
    assert dept.id is not None

    # 2. User
    user = User(
        employee_id="SEC001",
        full_name="Marcus Vance",
        email="mvance@enterprise.local",
        hashed_password=get_password_hash("DevSecretPass2026!"),
        role=UserRole.EMPLOYEE.value,
        department_id=dept.id,
        is_active=True,
        shift_start="09:15",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    assert user.id is not None
    assert user.department.code == "SEC-OPS"

    # 3. Encrypted FaceEmbedding
    ciphertext = encrypt_embedding(sample_embedding_512)
    embedding_record = FaceEmbedding(
        user_id=user.id,
        encrypted_embedding=ciphertext,
        embedding_version="facenet-512-v1",
    )
    db_session.add(embedding_record)
    db_session.commit()
    db_session.refresh(embedding_record)

    # Verify stored embedding is non-plaintext ciphertext
    assert is_ciphertext(embedding_record.encrypted_embedding) is True
    # Decrypt and verify equality
    restored_vector = decrypt_embedding(embedding_record.encrypted_embedding)
    assert np.allclose(restored_vector, sample_embedding_512, atol=1e-6)

    # 4. AttendanceLog
    today = date.today()
    checkin_time = datetime.now(timezone.utc)
    attendance = AttendanceLog(
        user_id=user.id,
        date=today,
        check_in_time=checkin_time,
        status="PRESENT",
        is_late=False,
        source="KIOSK",
    )
    db_session.add(attendance)
    db_session.commit()
    db_session.refresh(attendance)
    assert attendance.id is not None

    # 5. Unique Constraint: duplicate entry for (user_id, date) must raise IntegrityError
    duplicate_attendance = AttendanceLog(
        user_id=user.id,
        date=today,
        check_in_time=checkin_time,
        status="PRESENT",
        is_late=False,
        source="KIOSK",
    )
    db_session.add(duplicate_attendance)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
