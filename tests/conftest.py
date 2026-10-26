"""Pytest configuration and shared fixtures for Smart Attendance System."""

import os
import sys
import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.core.encryption import generate_encryption_key
from backend.app.core.security import CurrentUser, UserRole, create_access_token, get_password_hash
from backend.app.db.base import Base
from backend.app.models.attendance import AttendanceLog
from backend.app.models.department import Department
from backend.app.models.face_embedding import FaceEmbedding
from backend.app.models.user import User


@pytest.fixture(scope="session")
def test_key() -> str:
    """Fixture providing a fresh 256-bit encryption key for testing."""
    return generate_encryption_key()


@pytest.fixture(scope="function")
def sample_embedding_512() -> np.ndarray:
    """Fixture providing a realistic unit-normalized 512-d float32 biometric vector."""
    np.random.seed(42)
    vec = np.random.randn(512).astype(np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm


@pytest.fixture(scope="function")
def sample_embedding_512_alt() -> np.ndarray:
    """Fixture providing a distinct second 512-d float32 biometric vector."""
    np.random.seed(99)
    vec = np.random.randn(512).astype(np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm


from sqlalchemy.pool import StaticPool


@pytest.fixture(scope="function")
def db_session():
    """Fixture providing an isolated in-memory SQLite database session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False,
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture(scope="function")
def seed_department_and_users(db_session: Session):
    """Fixture seeding test department and users with all RBAC roles."""
    dept = Department(
        name="Engineering",
        code="ENG",
        description="Software Engineering Department",
    )
    db_session.add(dept)
    db_session.commit()
    db_session.refresh(dept)

    users_data = [
        ("EMP001", "Alice Admin", "alice@enterprise.com", UserRole.ADMIN),
        ("EMP002", "Bob HR", "bob@enterprise.com", UserRole.HR),
        ("EMP003", "Charlie Manager", "charlie@enterprise.com", UserRole.MANAGER),
        ("EMP004", "Dave Employee", "dave@enterprise.com", UserRole.EMPLOYEE),
    ]

    users = {}
    for emp_id, name, email, role in users_data:
        user = User(
            employee_id=emp_id,
            full_name=name,
            email=email,
            role=role.value,
            department_id=dept.id,
            hashed_password=get_password_hash("SecretPassword123!"),
            is_active=True,
            shift_start="09:15",
        )
        db_session.add(user)
        users[role] = user

    db_session.commit()
    for u in users.values():
        db_session.refresh(u)

    return {"department": dept, "users": users}
