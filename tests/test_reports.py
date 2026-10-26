"""Automated test suite for CSV, Excel (.xlsx), and PDF attendance reports."""

import csv
from datetime import date, datetime, timedelta
import io
import openpyxl
import pytest
from sqlalchemy.orm import Session

from backend.app.core.security import UserRole
from backend.app.models.attendance import AttendanceLog
from backend.app.models.department import Department
from backend.app.models.user import User
from backend.app.services.reports import (
    generate_csv_report,
    generate_excel_report,
    generate_pdf_report,
    generate_report,
)


@pytest.fixture
def sample_attendance_records(db_session: Session, seed_department_and_users: dict):
    """Seed multiple attendance logs across departments and dates for testing reports."""
    users = seed_department_and_users["users"]
    dept = seed_department_and_users["department"]

    # Also add a second department for filter testing
    finance_dept = Department(
        name="Finance",
        code="FIN",
        description="Corporate Finance",
    )
    db_session.add(finance_dept)
    db_session.commit()
    db_session.refresh(finance_dept)

    fin_user = User(
        employee_id="FIN001",
        full_name="Fiona Finance",
        email="fiona@enterprise.com",
        role=UserRole.EMPLOYEE.value,
        department_id=finance_dept.id,
        hashed_password="hashed_pw",
        is_active=True,
    )
    db_session.add(fin_user)
    db_session.commit()
    db_session.refresh(fin_user)

    target_date_1 = date(2026, 10, 25)
    target_date_2 = date(2026, 10, 26)

    records = [
        # 1. On-time full day
        AttendanceLog(
            user_id=users[UserRole.ADMIN].id,
            date=target_date_1,
            check_in_time=datetime(2026, 10, 25, 9, 0, 0),
            check_out_time=datetime(2026, 10, 25, 17, 30, 0),
            total_hours=8.5,
            status="PRESENT",
            is_late=False,
            source="KIOSK",
        ),
        # 2. Late arrival
        AttendanceLog(
            user_id=users[UserRole.HR].id,
            date=target_date_1,
            check_in_time=datetime(2026, 10, 25, 9, 35, 0),
            check_out_time=datetime(2026, 10, 25, 17, 0, 0),
            total_hours=7.42,
            status="LATE",
            is_late=True,
            source="KIOSK",
        ),
        # 3. Still checked in (no checkout yet)
        AttendanceLog(
            user_id=users[UserRole.EMPLOYEE].id,
            date=target_date_2,
            check_in_time=datetime(2026, 10, 26, 8, 50, 0),
            check_out_time=None,
            total_hours=None,
            status="PRESENT",
            is_late=False,
            source="CCTV",
        ),
        # 4. Finance employee
        AttendanceLog(
            user_id=fin_user.id,
            date=target_date_2,
            check_in_time=datetime(2026, 10, 26, 9, 10, 0),
            check_out_time=datetime(2026, 10, 26, 18, 10, 0),
            total_hours=9.0,
            status="PRESENT",
            is_late=False,
            source="MANUAL",
        ),
    ]

    for r in records:
        db_session.add(r)
    db_session.commit()

    # Re-query with eager relationships loaded
    loaded = (
        db_session.query(AttendanceLog)
        .order_by(AttendanceLog.id.asc())
        .all()
    )
    return {
        "records": loaded,
        "eng_dept": dept,
        "fin_dept": finance_dept,
        "fin_user": fin_user,
    }


def test_csv_report_generation(sample_attendance_records: dict):
    """Verify CSV export produces valid UTF-8 formatted CSV with headers and rows."""
    records = sample_attendance_records["records"]
    csv_bytes = generate_csv_report(records)

    assert isinstance(csv_bytes, bytes)
    assert len(csv_bytes) > 0

    csv_text = csv_bytes.decode("utf-8")
    lines = list(csv.reader(io.StringIO(csv_text)))

    # Assert headers
    expected_headers = [
        "Date",
        "Employee ID",
        "Employee Name",
        "Department",
        "Check-In",
        "Check-Out",
        "Total Hours",
        "Status",
        "Late",
        "Source",
    ]
    assert lines[0] == expected_headers

    # Assert 4 data rows
    assert len(lines) == 5

    # Check row 1 (Alice Admin)
    row_1 = lines[1]
    assert row_1[0] == "2026-10-25"
    assert row_1[1] == "EMP001"
    assert row_1[2] == "Alice Admin"
    assert row_1[3] == "Engineering"
    assert "09:00:00" in row_1[4]
    assert "17:30:00" in row_1[5]
    assert row_1[6] == "8.50"
    assert row_1[7] == "PRESENT"
    assert row_1[8] == "No"
    assert row_1[9] == "KIOSK"

    # Check row 2 (Bob HR - Late)
    row_2 = lines[2]
    assert row_2[1] == "EMP002"
    assert row_2[7] == "LATE"
    assert row_2[8] == "Yes"

    # Check row 3 (Dave Employee - in progress, check-out N/A)
    row_3 = lines[3]
    assert row_3[1] == "EMP004"
    assert row_3[5] == "N/A"
    assert row_3[6] == "N/A"


def test_excel_report_generation(sample_attendance_records: dict):
    """Verify Excel report produces valid openpyxl spreadsheet with styled headers and data."""
    records = sample_attendance_records["records"]
    xlsx_bytes = generate_excel_report(records)

    assert isinstance(xlsx_bytes, bytes)
    assert len(xlsx_bytes) > 0

    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
    assert "Attendance Summary" in wb.sheetnames
    ws = wb["Attendance Summary"]

    # Verify Header Row
    headers = [cell.value for cell in ws[1]]
    expected_headers = [
        "Date",
        "Employee ID",
        "Employee Name",
        "Department",
        "Check-In",
        "Check-Out",
        "Total Hours",
        "Status",
        "Late",
        "Source",
    ]
    assert headers == expected_headers

    # Verify Header Styling (navy blue fill, white bold font)
    header_cell = ws.cell(row=1, column=1)
    assert header_cell.font.bold is True
    assert header_cell.font.color.rgb == "00FFFFFF" or "FFFFFF" in str(header_cell.font.color.rgb)
    assert "1E3A8A" in str(header_cell.fill.start_color.rgb)

    # Verify Data Rows
    assert ws.max_row == 5
    emp_ids = [ws.cell(row=r, column=2).value for r in range(2, 6)]
    assert emp_ids == ["EMP001", "EMP002", "EMP004", "FIN001"]

    # Verify Column Widths auto-adjusted
    for col in ws.columns:
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        assert ws.column_dimensions[col_letter].width >= 12


def test_pdf_report_generation(sample_attendance_records: dict):
    """Verify PDF report produces valid ReportLab document with %PDF magic header."""
    records = sample_attendance_records["records"]
    start_date = date(2026, 10, 25)
    end_date = date(2026, 10, 26)

    pdf_bytes = generate_pdf_report(
        records=records,
        start_date=start_date,
        end_date=end_date,
        department_name="Engineering",
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # Standard PDF file header magic bytes
    assert pdf_bytes.startswith(b"%PDF-")


def test_generate_report_dispatcher_filters(
    db_session: Session, sample_attendance_records: dict
):
    """Verify high-level generate_report queries and filters accurately."""
    start_date = date(2026, 10, 25)
    end_date = date(2026, 10, 26)

    # 1. Filter by Department (Finance only -> 1 record)
    fin_dept = sample_attendance_records["fin_dept"]
    csv_bytes, media_type, filename = generate_report(
        db=db_session,
        start_date=start_date,
        end_date=end_date,
        department_id=fin_dept.id,
        report_format="csv",
    )
    assert "text/csv" in media_type
    assert "attendance_report_" in filename
    lines = list(csv.reader(io.StringIO(csv_bytes.decode("utf-8"))))
    assert len(lines) == 2  # header + 1 record
    assert lines[1][1] == "FIN001"

    # 2. Filter by Status (LATE only -> 1 record)
    csv_late, _, _ = generate_report(
        db=db_session,
        start_date=start_date,
        end_date=end_date,
        status="LATE",
        report_format="csv",
    )
    late_lines = list(csv.reader(io.StringIO(csv_late.decode("utf-8"))))
    assert len(late_lines) == 2
    assert late_lines[1][1] == "EMP002"

    # 3. Excel format dispatcher
    xlsx_bytes, media_type_xlsx, fname_xlsx = generate_report(
        db=db_session,
        start_date=start_date,
        end_date=end_date,
        report_format="xlsx",
    )
    assert "spreadsheetml" in media_type_xlsx
    assert fname_xlsx.endswith(".xlsx")
    assert len(xlsx_bytes) > 0

    # 4. PDF format dispatcher
    pdf_bytes, media_type_pdf, fname_pdf = generate_report(
        db=db_session,
        start_date=start_date,
        end_date=end_date,
        report_format="pdf",
    )
    assert media_type_pdf == "application/pdf"
    assert fname_pdf.endswith(".pdf")
    assert pdf_bytes.startswith(b"%PDF")


def test_empty_records_reports():
    """Verify report generators handle zero records gracefully without crashing."""
    # CSV empty
    csv_bytes = generate_csv_report([])
    lines = list(csv.reader(io.StringIO(csv_bytes.decode("utf-8"))))
    assert len(lines) == 1  # Only headers

    # Excel empty
    xlsx_bytes = generate_excel_report([])
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
    ws = wb.active
    assert ws.max_row == 1

    # PDF empty
    pdf_bytes = generate_pdf_report([], date(2026, 10, 1), date(2026, 10, 2))
    assert pdf_bytes.startswith(b"%PDF")
