"""Integration tests for FastAPI REST Gateway endpoints."""

from datetime import date, datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.core.security import UserRole, create_access_token
from backend.app.main import app
from backend.app.models.user import User


@pytest.fixture
def client(db_session: Session):
    """Provide a TestClient with database session overridden by test db_session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers(seed_department_and_users: dict) -> dict:
    admin_user: User = seed_department_and_users["users"][UserRole.ADMIN]
    token = create_access_token(
        subject=admin_user.id,
        role=admin_user.role,
        extra_claims={
            "employee_id": admin_user.employee_id,
            "email": admin_user.email,
            "full_name": admin_user.full_name,
        },
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def employee_headers(seed_department_and_users: dict) -> dict:
    emp_user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]
    token = create_access_token(
        subject=emp_user.id,
        role=emp_user.role,
        extra_claims={
            "employee_id": emp_user.employee_id,
            "email": emp_user.email,
            "full_name": emp_user.full_name,
        },
    )
    return {"Authorization": f"Bearer {token}"}


def test_health_check_endpoint(client: TestClient):
    """Verify GET /health returns status 200 and healthy status."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_auth_login_and_me_endpoints(client: TestClient, seed_department_and_users: dict):
    """Verify POST /api/v1/auth/login and GET /api/v1/auth/me."""
    # 1. Successful Login
    login_payload = {
        "email": "alice@enterprise.com",
        "password": "SecretPassword123!",
    }
    resp = client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 200
    token_data = resp.json()
    assert "access_token" in token_data
    assert token_data["role"] == "ADMIN"
    assert token_data["employee_id"] == "EMP001"

    # 2. Invalid credentials
    bad_login = {
        "email": "alice@enterprise.com",
        "password": "WrongPassword!",
    }
    resp_bad = client.post("/api/v1/auth/login", json=bad_login)
    assert resp_bad.status_code == 401

    # 3. GET /auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == "alice@enterprise.com"
    assert me_data["full_name"] == "Alice Admin"


def test_departments_crud_and_rbac(
    client: TestClient,
    admin_headers: dict,
    employee_headers: dict,
):
    """Verify department listing, creation by Admin/HR, and rejection of unauthorized Employee."""
    # Employee cannot create department (RBAC -> 403 Forbidden)
    forbidden_resp = client.post(
        "/api/v1/departments/",
        json={"name": "Forbidden Dept", "code": "FORBID"},
        headers=employee_headers,
    )
    assert forbidden_resp.status_code == 403

    # Admin can create department
    create_resp = client.post(
        "/api/v1/departments/",
        json={"name": "Human Resources", "code": "HRD", "description": "HR Dept"},
        headers=admin_headers,
    )
    assert create_resp.status_code == 201
    created_dept = create_resp.json()
    assert created_dept["name"] == "Human Resources"

    # Anyone authenticated can list departments
    list_resp = client.get("/api/v1/departments/", headers=employee_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 2


def test_employees_crud_and_filtering(
    client: TestClient,
    admin_headers: dict,
    employee_headers: dict,
):
    """Verify employee registration, listing, and updates."""
    # Admin registers a new employee
    new_emp_payload = {
        "employee_id": "EMP099",
        "full_name": "Zara Newbie",
        "email": "zara@enterprise.com",
        "password": "Password123!",
        "role": "EMPLOYEE",
        "shift_start": "09:30",
    }
    create_resp = client.post(
        "/api/v1/employees/",
        json=new_emp_payload,
        headers=admin_headers,
    )
    assert create_resp.status_code == 201
    emp_data = create_resp.json()
    assert emp_data["employee_id"] == "EMP099"
    assert emp_data["has_face_enrolled"] is False

    # List employees with search filter
    search_resp = client.get(
        "/api/v1/employees/?search=Zara",
        headers=employee_headers,
    )
    assert search_resp.status_code == 200
    results = search_resp.json()
    assert len(results) == 1
    assert results[0]["full_name"] == "Zara Newbie"


def test_biometrics_enroll_and_recognize_api(
    client: TestClient,
    admin_headers: dict,
    sample_embedding_512: list,
    seed_department_and_users: dict,
):
    """Verify facial embedding enrollment and recognition through the API."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]

    # 1. Enroll face embedding (512-d vector)
    enroll_payload = {
        "employee_id": user.employee_id,
        "embedding": sample_embedding_512.tolist(),
    }
    enroll_resp = client.post(
        "/api/v1/biometrics/enroll",
        json=enroll_payload,
        headers=admin_headers,
    )
    assert enroll_resp.status_code == 200
    enroll_data = enroll_resp.json()
    assert enroll_data["user_id"] == user.id

    # 2. Recognize face using matching query vector
    recognize_payload = {
        "embedding": sample_embedding_512.tolist(),
    }
    rec_resp = client.post("/api/v1/biometrics/recognize", json=recognize_payload)
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["matched"] is True
    assert rec_data["employee_id"] == user.employee_id
    assert rec_data["similarity_score"] >= 0.75
    assert rec_data["attendance"] is not None
    assert rec_data["attendance"]["event_result"] == "CHECKED_IN"


def test_attendance_endpoints_flow(
    client: TestClient,
    admin_headers: dict,
    employee_headers: dict,
    seed_department_and_users: dict,
):
    """Verify /attendance/events, /attendance/summary, /attendance/logs, /attendance/status."""
    user: User = seed_department_and_users["users"][UserRole.EMPLOYEE]

    # 1. Trigger attendance event
    event_payload = {
        "employee_id": user.employee_id,
        "timestamp": "2026-10-26T09:05:00",
        "source": "KIOSK",
    }
    event_resp = client.post("/api/v1/attendance/events", json=event_payload)
    assert event_resp.status_code == 200
    assert event_resp.json()["event_result"] == "CHECKED_IN"

    # 2. Check employee status
    st_resp = client.get(
        f"/api/v1/attendance/status/{user.employee_id}?target_date=2026-10-26",
        headers=employee_headers,
    )
    assert st_resp.status_code == 200
    st_data = st_resp.json()
    assert st_data["is_checked_in"] is True
    assert st_data["status"] == "PRESENT"

    # 3. Check dashboard summary
    summary_resp = client.get(
        "/api/v1/attendance/summary?target_date=2026-10-26",
        headers=employee_headers,
    )
    assert summary_resp.status_code == 200
    sum_data = summary_resp.json()
    assert sum_data["present_count"] >= 1

    # 4. Check attendance logs list
    logs_resp = client.get(
        "/api/v1/attendance/logs?employee_id=" + user.employee_id,
        headers=employee_headers,
    )
    assert logs_resp.status_code == 200
    logs_data = logs_resp.json()
    assert len(logs_data) >= 1
    assert logs_data[0]["employee_id"] == user.employee_id


def test_reports_export_api_endpoints(
    client: TestClient,
    employee_headers: dict,
    seed_department_and_users: dict,
):
    """Verify /reports/export endpoint returns CSV, XLSX, and PDF streams."""
    # Export CSV
    resp_csv = client.get(
        "/api/v1/reports/export?format=csv&start_date=2026-10-01&end_date=2026-10-31",
        headers=employee_headers,
    )
    assert resp_csv.status_code == 200
    assert "text/csv" in resp_csv.headers["content-type"]
    assert "attachment;" in resp_csv.headers["content-disposition"]

    # Export Excel (.xlsx)
    resp_xlsx = client.get(
        "/api/v1/reports/export?format=xlsx&start_date=2026-10-01&end_date=2026-10-31",
        headers=employee_headers,
    )
    assert resp_xlsx.status_code == 200
    assert "spreadsheetml" in resp_xlsx.headers["content-type"]
    assert len(resp_xlsx.content) > 0

    # Export PDF
    resp_pdf = client.get(
        "/api/v1/reports/export?format=pdf&start_date=2026-10-01&end_date=2026-10-31",
        headers=employee_headers,
    )
    assert resp_pdf.status_code == 200
    assert "application/pdf" in resp_pdf.headers["content-type"]
    assert resp_pdf.content.startswith(b"%PDF")
