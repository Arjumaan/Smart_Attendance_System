"""Tests for Employee Attendance Self-Service Portal and Leave/Permission Request Workflows."""

import pytest
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.core.security import CurrentUser, UserRole, create_access_token
from backend.app.db.session import get_db
from backend.app.main import app
from backend.app.models.attendance import AttendanceLog
from backend.app.models.leave import LeaveRequest
from backend.app.models.user import User


@pytest.fixture
def client(db_session: Session):
    """Test client overriding the get_db dependency with test database session."""
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
def auth_headers(seed_department_and_users):
    """Generate Authorization Bearer headers for each role."""
    users = seed_department_and_users["users"]
    headers = {}
    for role, user in users.items():
        token = create_access_token(
            subject=user.id,
            role=user.role,
            extra_claims={
                "employee_id": user.employee_id,
                "email": user.email,
                "full_name": user.full_name,
            },
        )
        headers[role] = {"Authorization": f"Bearer {token}"}
    return headers


def test_my_attendance_isolation(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Test that an employee can only view their own attendance records."""
    users = seed_department_and_users["users"]
    employee = users[UserRole.EMPLOYEE]
    admin = users[UserRole.ADMIN]

    today = date.today()

    # Create logs: 1 for employee, 1 for admin
    emp_log = AttendanceLog(
        user_id=employee.id,
        date=today,
        check_in_time=datetime.utcnow() - timedelta(hours=8),
        check_out_time=datetime.utcnow(),
        total_hours=8.0,
        status="PRESENT",
        is_late=False,
        source="BIOMETRIC",
    )
    admin_log = AttendanceLog(
        user_id=admin.id,
        date=today,
        check_in_time=datetime.utcnow() - timedelta(hours=9),
        check_out_time=datetime.utcnow(),
        total_hours=9.0,
        status="PRESENT",
        is_late=False,
        source="BIOMETRIC",
    )
    db_session.add_all([emp_log, admin_log])
    db_session.commit()

    # Employee requests /my-attendance
    resp = client.get("/api/v1/attendance/my-attendance", headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == employee.id
    assert data[0]["employee_id"] == employee.employee_id


def test_my_attendance_summary(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Test employee personal KPI metrics and attendance summary."""
    users = seed_department_and_users["users"]
    employee = users[UserRole.EMPLOYEE]

    today = date.today()
    log = AttendanceLog(
        user_id=employee.id,
        date=today,
        check_in_time=datetime.utcnow() - timedelta(hours=7),
        check_out_time=datetime.utcnow(),
        total_hours=7.0,
        status="PRESENT",
        is_late=False,
        source="BIOMETRIC",
    )
    db_session.add(log)
    db_session.commit()

    resp = client.get("/api/v1/attendance/my-summary", headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["employee_id"] == employee.employee_id
    assert summary["full_name"] == employee.full_name
    assert summary["total_days"] == 1
    assert summary["on_time_count"] == 1
    assert summary["attendance_rate"] == 100.0
    assert summary["today_status"] == "CHECKED_OUT"


def test_leave_application_and_validation(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Test applying for leave and permissions with validation constraints."""
    today = date.today()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    # 1. Successful Leave Application
    leave_payload = {
        "request_type": "LEAVE",
        "leave_type": "CASUAL",
        "start_date": today.isoformat(),
        "end_date": tomorrow.isoformat(),
        "reason": "Family emergency requires travel.",
    }
    resp = client.post("/api/v1/leaves/", json=leave_payload, headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 201
    leave_data = resp.json()
    assert leave_data["status"] == "PENDING"
    assert leave_data["leave_type"] == "CASUAL"
    assert leave_data["employee_id"] == "EMP004"

    # 2. Invalid Date Order (end date < start date)
    invalid_dates = {
        "request_type": "LEAVE",
        "leave_type": "SICK",
        "start_date": today.isoformat(),
        "end_date": yesterday.isoformat(),
        "reason": "Invalid date range test.",
    }
    resp = client.post("/api/v1/leaves/", json=invalid_dates, headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 400
    assert "cannot be earlier than" in resp.json()["detail"].lower()

    # 3. Successful Permission Application
    perm_payload = {
        "request_type": "PERMISSION",
        "leave_type": "PERMISSION",
        "start_date": today.isoformat(),
        "start_time": "14:00",
        "end_time": "16:00",
        "duration_hours": 2.0,
        "reason": "Doctor appointment.",
    }
    resp = client.post("/api/v1/leaves/", json=perm_payload, headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 201
    perm_data = resp.json()
    assert perm_data["request_type"] == "PERMISSION"
    assert perm_data["duration_hours"] == 2.0


def test_employee_my_requests_isolation(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Verify employees only see their own leave requests in /my-requests."""
    users = seed_department_and_users["users"]
    emp = users[UserRole.EMPLOYEE]
    manager = users[UserRole.MANAGER]

    req1 = LeaveRequest(
        user_id=emp.id,
        request_type="LEAVE",
        leave_type="CASUAL",
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 2),
        reason="Employee personal leave",
        status="PENDING",
    )
    req2 = LeaveRequest(
        user_id=manager.id,
        request_type="LEAVE",
        leave_type="ANNUAL",
        start_date=date(2026, 11, 5),
        end_date=date(2026, 11, 10),
        reason="Manager vacation",
        status="PENDING",
    )
    db_session.add_all([req1, req2])
    db_session.commit()

    resp = client.get("/api/v1/leaves/my-requests", headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 200
    my_reqs = resp.json()
    assert len(my_reqs) == 1
    assert my_reqs[0]["id"] == req1.id


def test_admin_hr_review_workflow(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Test full review workflow: Enquire -> Reply -> Approve."""
    users = seed_department_and_users["users"]
    emp = users[UserRole.EMPLOYEE]

    # Employee submits leave
    req = LeaveRequest(
        user_id=emp.id,
        request_type="LEAVE",
        leave_type="SICK",
        start_date=date(2026, 11, 15),
        end_date=date(2026, 11, 16),
        reason="Severe migraine medical consultation.",
        status="PENDING",
    )
    db_session.add(req)
    db_session.commit()
    db_session.refresh(req)

    # 1. Admin checks pending count
    resp = client.get("/api/v1/leaves/pending-count", headers=auth_headers[UserRole.ADMIN])
    assert resp.status_code == 200
    assert resp.json()["pending_count"] == 1

    # 2. Regular employee cannot access Admin company-wide leaves list (RBAC check)
    resp = client.get("/api/v1/leaves/", headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 403

    # 3. Admin / HR views all leaves
    resp = client.get("/api/v1/leaves/", headers=auth_headers[UserRole.HR])
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # 4. Admin issues Enquiry
    enquire_payload = {
        "action": "ENQUIRE",
        "admin_notes": "Please attach doctor consultation slip or indicate shift coverage.",
    }
    resp = client.post(f"/api/v1/leaves/{req.id}/action", json=enquire_payload, headers=auth_headers[UserRole.ADMIN])
    assert resp.status_code == 200
    assert resp.json()["status"] == "ENQUIRY_REQUESTED"
    assert resp.json()["admin_notes"] == enquire_payload["admin_notes"]

    # 5. Employee replies to enquiry
    reply_payload = {
        "reply": "Dr slip attached: Dr. Kumar Clinic ref #9821. Shift covered by Alex.",
    }
    resp = client.put(f"/api/v1/leaves/my-requests/{req.id}/reply", json=reply_payload, headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 200
    assert resp.json()["status"] == "PENDING"
    assert resp.json()["employee_reply"] == reply_payload["reply"]

    # 6. HR reviews and approves
    approve_payload = {
        "action": "APPROVE",
        "admin_notes": "Approved. Have a swift recovery.",
    }
    resp = client.post(f"/api/v1/leaves/{req.id}/action", json=approve_payload, headers=auth_headers[UserRole.HR])
    assert resp.status_code == 200
    assert resp.json()["status"] == "APPROVED"
    assert resp.json()["admin_notes"] == approve_payload["admin_notes"]


def test_employee_cancel_leave_request(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Test employee can withdraw/cancel their own pending leave request."""
    users = seed_department_and_users["users"]
    emp = users[UserRole.EMPLOYEE]

    req = LeaveRequest(
        user_id=emp.id,
        request_type="LEAVE",
        leave_type="CASUAL",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 2),
        reason="Personal trip planned.",
        status="PENDING",
    )
    db_session.add(req)
    db_session.commit()
    db_session.refresh(req)

    # Cancel request
    resp = client.post(f"/api/v1/leaves/my-requests/{req.id}/cancel", headers=auth_headers[UserRole.EMPLOYEE])
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"

    # Cannot cancel already cancelled
    resp2 = client.post(f"/api/v1/leaves/my-requests/{req.id}/cancel", headers=auth_headers[UserRole.EMPLOYEE])
    assert resp2.status_code == 400


def test_approved_leave_reflected_as_on_leave_in_attendance(client: TestClient, db_session: Session, seed_department_and_users, auth_headers):
    """Test that employees with approved leaves are reported as ON_LEAVE instead of ABSENT."""
    users = seed_department_and_users["users"]
    emp = users[UserRole.EMPLOYEE]
    today = date.today()

    req = LeaveRequest(
        user_id=emp.id,
        request_type="LEAVE",
        leave_type="ANNUAL",
        start_date=today,
        end_date=today + timedelta(days=2),
        reason="Annual vacation.",
        status="APPROVED",
    )
    db_session.add(req)
    db_session.commit()

    # Query with status=ON_LEAVE
    resp = client.get(f"/api/v1/attendance/logs?status=ON_LEAVE&start_date={today.isoformat()}", headers=auth_headers[UserRole.ADMIN])
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["employee_id"] == emp.employee_id
    assert data[0]["status"] == "ON_LEAVE"
    assert "ANNUAL" in data[0]["notes"]

