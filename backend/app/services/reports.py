"""Enterprise Attendance Report Generation Service.

Provides:
- CSV report generator (UTF-8 formatted).
- Microsoft Excel (.xlsx) styled report generator via openpyxl.
- Enterprise PDF report generator with corporate header & audit tables via ReportLab.
- High-level query & filter dispatcher.
"""

import csv
from datetime import date, datetime
import io
from typing import List, Optional, Tuple

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.attendance import AttendanceLog
from backend.app.models.department import Department
from backend.app.models.leave import LeaveRequest
from backend.app.models.user import User


def _extract_record_fields(log: AttendanceLog) -> dict:
    """Safely extract display fields from an AttendanceLog model."""
    emp_id = "N/A"
    emp_name = "Unknown"
    dept_name = "N/A"

    if log.user:
        emp_id = log.user.employee_id or "N/A"
        emp_name = log.user.full_name or "Unknown"
        if log.user.department:
            dept_name = log.user.department.name or "N/A"

    check_in_str = (
        log.check_in_time.strftime("%Y-%m-%d %H:%M:%S")
        if log.check_in_time
        else "N/A"
    )
    check_out_str = (
        log.check_out_time.strftime("%Y-%m-%d %H:%M:%S")
        if log.check_out_time
        else "N/A"
    )
    hours_str = f"{log.total_hours:.2f}" if log.total_hours is not None else "N/A"
    late_str = "Yes" if log.is_late else "No"

    return {
        "date": str(log.date),
        "employee_id": emp_id,
        "full_name": emp_name,
        "department": dept_name,
        "check_in": check_in_str,
        "check_out": check_out_str,
        "total_hours": hours_str,
        "status": log.status,
        "is_late": late_str,
        "source": log.source or "KIOSK",
    }


def generate_csv_report(records: List[AttendanceLog]) -> bytes:
    """Generate a valid UTF-8 CSV report from attendance records.

    Headers:
    Date, Employee ID, Employee Name, Department, Check-In, Check-Out, Total Hours, Status, Late, Source
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
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
    writer.writerow(headers)

    for rec in records:
        f = _extract_record_fields(rec)
        writer.writerow([
            f["date"],
            f["employee_id"],
            f["full_name"],
            f["department"],
            f["check_in"],
            f["check_out"],
            f["total_hours"],
            f["status"],
            f["is_late"],
            f["source"],
        ])

    return output.getvalue().encode("utf-8")


def generate_excel_report(records: List[AttendanceLog]) -> bytes:
    """Generate a professionally styled Microsoft Excel (.xlsx) workbook using openpyxl.

    Includes:
    - Enterprise navy blue header styling with bold white text.
    - Zebra-striped data rows with thin borders.
    - Auto-adjusted column widths.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance Summary"

    headers = [
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

    ws.append(headers)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")

    thin_border_side = Side(style="thin", color="CBD5E1")
    cell_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = cell_border

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    for row_idx, rec in enumerate(records, start=2):
        ws.row_dimensions[row_idx].height = 20
        f = _extract_record_fields(rec)
        row_vals = [
            f["date"],
            f["employee_id"],
            f["full_name"],
            f["department"],
            f["check_in"],
            f["check_out"],
            f["total_hours"],
            f["status"],
            f["is_late"],
            f["source"],
        ]
        ws.append(row_vals)

        fill_to_apply = zebra_fill if row_idx % 2 == 0 else white_fill
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = fill_to_apply
            cell.border = cell_border
            # Column-specific alignment
            if col_idx in (1, 5, 6, 7, 8, 9, 10):
                cell.alignment = center_align
            else:
                cell.alignment = left_align

    # Auto-adjust column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_pdf_report(
    records: List[AttendanceLog],
    start_date: date,
    end_date: date,
    department_name: str = "All",
) -> bytes:
    """Generate an enterprise attendance PDF audit report using ReportLab.

    Includes:
    - Corporate title and report metadata block.
    - Attendance summary KPI statistics.
    - Grid table with colored header, alternating row background, and clean typography.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#1E3A8A"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748B"),
        fontName="Helvetica",
    )
    meta_style = ParagraphStyle(
        "MetaText",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        fontName="Helvetica",
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
        fontName="Helvetica",
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.white,
        fontName="Helvetica-Bold",
        alignment=1,
    )

    elements = []

    # Title & Header
    elements.append(Paragraph("Enterprise Smart Attendance System", title_style))
    elements.append(Paragraph("Automated Biometrics & Presence Audit Report", subtitle_style))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1E3A8A"), spaceAfter=12))

    # Metadata & KPI summary
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total_records = len(records)
    late_count = sum(1 for r in records if r.is_late or r.status == "LATE")
    total_work_hours = sum(r.total_hours for r in records if r.total_hours is not None)

    meta_data = [
        [
            Paragraph(f"<b>Date Range:</b> {start_date} to {end_date}", meta_style),
            Paragraph(f"<b>Department:</b> {department_name}", meta_style),
            Paragraph(f"<b>Generated At:</b> {now_str}", meta_style),
        ],
        [
            Paragraph(f"<b>Total Logs:</b> {total_records}", meta_style),
            Paragraph(f"<b>Late Check-Ins:</b> {late_count}", meta_style),
            Paragraph(f"<b>Total Work Hours:</b> {total_work_hours:.2f} hrs", meta_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[240, 240, 240])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 14))

    # Main Attendance Records Table
    col_headers = [
        "Date",
        "Emp ID",
        "Employee Name",
        "Department",
        "Check-In",
        "Check-Out",
        "Hours",
        "Status",
        "Late",
        "Source",
    ]
    table_rows = [[Paragraph(h, table_header_style) for h in col_headers]]

    for rec in records:
        f = _extract_record_fields(rec)
        table_rows.append([
            Paragraph(f["date"], table_cell_style),
            Paragraph(f["employee_id"], table_cell_style),
            Paragraph(f["full_name"], table_cell_style),
            Paragraph(f["department"], table_cell_style),
            Paragraph(f["check_in"], table_cell_style),
            Paragraph(f["check_out"], table_cell_style),
            Paragraph(f["total_hours"], table_cell_style),
            Paragraph(f["status"], table_cell_style),
            Paragraph(f["is_late"], table_cell_style),
            Paragraph(f["source"], table_cell_style),
        ])

    if total_records == 0:
        no_data_para = Paragraph("No attendance records found for the selected criteria.", meta_style)
        table_rows.append([no_data_para] + [Paragraph("", table_cell_style) for _ in range(len(col_headers) - 1)])

    # 10 columns across ~720 points printable width in landscape letter
    col_widths = [62, 55, 95, 80, 95, 95, 45, 52, 38, 50]
    rec_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    rec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(rec_table)

    doc.build(elements)
    return buf.getvalue()


def generate_report(
    db: Session,
    start_date: date,
    end_date: date,
    department_id: Optional[int] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    report_format: str = "csv",
) -> Tuple[bytes, str, str]:
    """Query database with filters and export report in CSV, XLSX, or PDF.

    Returns:
        Tuple of (content_bytes, media_type, filename)
    """
    query = (
        db.query(AttendanceLog)
        .join(User, AttendanceLog.user_id == User.id)
        .options(joinedload(AttendanceLog.user).joinedload(User.department))
        .filter(AttendanceLog.date >= start_date, AttendanceLog.date <= end_date)
    )

    dept_name = "All Departments"
    if department_id:
        query = query.filter(User.department_id == department_id)
        dept_obj = db.query(Department).filter(Department.id == department_id).first()
        if dept_obj:
            dept_name = dept_obj.name

    if employee_id and employee_id.strip():
        term = f"%{employee_id.strip()}%"
        query = query.filter(
            or_(
                User.employee_id.ilike(term),
                User.full_name.ilike(term),
                User.email.ilike(term),
            )
        )

    records = None
    if status and status.strip():
        stat_upper = status.strip().upper()
        if stat_upper == "LATE":
            query = query.filter(
                or_(
                    AttendanceLog.status == "LATE",
                    AttendanceLog.is_late.is_(True),
                )
            )
        elif stat_upper == "PRESENT":
            query = query.filter(
                AttendanceLog.status == "PRESENT",
                AttendanceLog.is_late.is_(False),
            )
        elif stat_upper in ("ABSENT", "ON_LEAVE"):
            # For absentees and employees on leave, generate synthetic attendance records for unlogged active employees
            target_date = end_date or start_date or date.today()
            active_q = (
                db.query(User)
                .options(joinedload(User.department))
                .filter(User.is_active.is_(True))
            )
            if department_id:
                active_q = active_q.filter(User.department_id == department_id)
            if employee_id and employee_id.strip():
                clean_term = f"%{employee_id.strip()}%"
                active_q = active_q.filter(
                    or_(
                        User.employee_id.ilike(clean_term),
                        User.full_name.ilike(clean_term),
                        User.email.ilike(clean_term),
                    )
                )

            logged_uids = {
                uid
                for (uid,) in db.query(AttendanceLog.user_id)
                .filter(AttendanceLog.date == target_date)
                .all()
            }

            approved_leaves = (
                db.query(LeaveRequest)
                .filter(
                    LeaveRequest.status == "APPROVED",
                    LeaveRequest.start_date <= target_date,
                    LeaveRequest.end_date >= target_date,
                )
                .all()
            )
            leave_map = {l.user_id: l for l in approved_leaves}

            unlogged_users = [u for u in active_q.all() if u.id not in logged_uids]
            if stat_upper == "ON_LEAVE":
                target_users = [u for u in unlogged_users if u.id in leave_map]
            else:
                target_users = [u for u in unlogged_users if u.id not in leave_map]

            now_dt = datetime.now()
            records = [
                AttendanceLog(
                    id=-u.id,
                    user_id=u.id,
                    user=u,
                    date=target_date,
                    check_in_time=None,
                    check_out_time=None,
                    total_hours=0.0,
                    status="ON_LEAVE" if u.id in leave_map else "ABSENT",
                    is_late=False,
                    source="SYSTEM",
                    notes=(
                        f"Approved Leave: {leave_map[u.id].leave_type}"
                        if u.id in leave_map
                        else "No presence recorded."
                    ),
                    created_at=now_dt,
                    updated_at=now_dt,
                )
                for u in target_users
            ]
        else:
            query = query.filter(AttendanceLog.status == stat_upper)

    if records is None:
        records = (
            query.order_by(AttendanceLog.date.desc(), AttendanceLog.check_in_time.asc())
            .all()
        )

    fmt = report_format.lower().strip()
    date_str = f"{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"

    if fmt in ("xlsx", "excel"):
        content = generate_excel_report(records)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"attendance_report_{date_str}.xlsx"
    elif fmt == "pdf":
        content = generate_pdf_report(records, start_date, end_date, department_name=dept_name)
        media_type = "application/pdf"
        filename = f"attendance_report_{date_str}.pdf"
    else:
        content = generate_csv_report(records)
        media_type = "text/csv; charset=utf-8"
        filename = f"attendance_report_{date_str}.csv"

    return content, media_type, filename


# ============================================================================
# LEAVE & PERMISSION REPORT GENERATION SERVICE
# ============================================================================

def _extract_leave_fields(req: LeaveRequest) -> dict:
    """Safely extract display fields from a LeaveRequest model."""
    emp_id = "N/A"
    emp_name = "Unknown"
    dept_name = "General"
    if req.user:
        emp_id = req.user.employee_id or "N/A"
        emp_name = req.user.full_name or "Unknown"
        if req.user.department:
            dept_name = req.user.department.name or "General"

    if req.request_type == "PERMISSION":
        schedule_str = f"{req.start_date}"
        if req.start_time and req.end_time:
            schedule_str += f" ({req.start_time} - {req.end_time})"
        duration_str = f"{req.duration_hours or 0.0:.1f} hrs"
    else:
        if req.end_date and req.end_date != req.start_date:
            schedule_str = f"{req.start_date} to {req.end_date}"
            try:
                days = max(1, (req.end_date - req.start_date).days + 1)
                duration_str = f"{days} days"
            except Exception:
                duration_str = "1 day"
        else:
            schedule_str = f"{req.start_date}"
            duration_str = "1 day"

    rev_name = req.reviewer.full_name if req.reviewer else "Pending Decision"
    applied_str = req.created_at.strftime("%Y-%m-%d") if req.created_at else "N/A"

    return {
        "id": f"#{req.id}",
        "employee_id": emp_id,
        "employee_name": emp_name,
        "department": dept_name,
        "request_type": req.request_type or "LEAVE",
        "leave_type": req.leave_type or "CASUAL",
        "schedule": schedule_str,
        "duration": duration_str,
        "status": req.status or "PENDING",
        "reviewer": rev_name,
        "reason": req.reason or "",
        "admin_notes": req.admin_notes or "",
        "employee_reply": req.employee_reply or "",
        "created_at": applied_str,
    }


def generate_leave_csv_report(records: List[LeaveRequest]) -> bytes:
    """Generate a clean UTF-8 CSV report with BOM from leave and permission requests."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    headers = [
        "Ref ID",
        "Employee ID",
        "Employee Name",
        "Department",
        "Category",
        "Leave Type",
        "Schedule",
        "Duration",
        "Status",
        "Reviewer",
        "Reason",
        "Decision Note",
        "Employee Reply",
        "Applied Date",
    ]
    writer.writerow(headers)

    for rec in records:
        f = _extract_leave_fields(rec)
        writer.writerow([
            f["id"],
            f["employee_id"],
            f["employee_name"],
            f["department"],
            f["request_type"],
            f["leave_type"],
            f["schedule"],
            f["duration"],
            f["status"],
            f["reviewer"],
            f["reason"],
            f["admin_notes"],
            f["employee_reply"],
            f["created_at"],
        ])

    return output.getvalue().encode("utf-8-sig")


def generate_leave_excel_report(records: List[LeaveRequest]) -> bytes:
    """Generate a professionally styled Microsoft Excel (.xlsx) workbook for leaves."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Leave Audit Ledger"

    # Executive counts of approved leaves taken
    casual_taken = sum(1 for r in records if r.status == "APPROVED" and r.leave_type == "CASUAL")
    sick_taken = sum(1 for r in records if r.status == "APPROVED" and r.leave_type == "SICK")
    annual_taken = sum(1 for r in records if r.status == "APPROVED" and r.leave_type == "ANNUAL")
    emergency_taken = sum(1 for r in records if r.status == "APPROVED" and r.leave_type == "EMERGENCY")
    permission_taken = sum(1 for r in records if r.status == "APPROVED" and r.request_type == "PERMISSION")

    headers = [
        "Ref ID",
        "Employee ID",
        "Employee Name",
        "Department",
        "Category",
        "Leave Type",
        "Schedule",
        "Duration",
        "Status",
        "Reviewer",
        "Reason",
        "Decision Note",
        "Applied Date",
    ]
    ws.append(headers)

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="064E3B", end_color="064E3B", fill_type="solid")  # Emerald dark
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")

    thin_border_side = Side(style="thin", color="CBD5E1")
    cell_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    ws.row_dimensions[1].height = 28
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = cell_border

    zebra_fill = PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    for row_idx, rec in enumerate(records, start=2):
        ws.row_dimensions[row_idx].height = 22
        f = _extract_leave_fields(rec)
        row_vals = [
            f["id"],
            f["employee_id"],
            f["employee_name"],
            f["department"],
            f["request_type"],
            f["leave_type"],
            f["schedule"],
            f["duration"],
            f["status"],
            f["reviewer"],
            f["reason"],
            f["admin_notes"],
            f["created_at"],
        ]
        ws.append(row_vals)

        fill_to_apply = zebra_fill if row_idx % 2 == 0 else white_fill
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = fill_to_apply
            cell.border = cell_border
            if col_idx in (1, 2, 5, 6, 8, 9, 13):
                cell.alignment = center_align
            else:
                cell.alignment = left_align

    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 40)

    # Summary Sheet for HR
    ws_sum = wb.create_sheet(title="Leaves Taken Summary")
    ws_sum.column_dimensions["A"].width = 35
    ws_sum.column_dimensions["B"].width = 22
    ws_sum.column_dimensions["C"].width = 20

    sum_headers = ["Leave / Absence Category", "Approved Taken Count", "Status"]
    ws_sum.append(sum_headers)
    ws_sum.row_dimensions[1].height = 26
    for col_idx in range(1, 4):
        cell = ws_sum.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align
        cell.border = cell_border

    summary_rows = [
        ["Casual Leaves Taken (CL)", casual_taken, "Approved"],
        ["Medical / Sick Leaves Taken (SL)", sick_taken, "Approved"],
        ["Annual / Vacation Leaves Taken (AL)", annual_taken, "Approved"],
        ["Emergency Leaves Taken (EL)", emergency_taken, "Approved"],
        ["Permissions Granted (Hourly Outings)", permission_taken, "Approved"],
        ["Total Applications Audited", len(records), "All Statuses"],
    ]

    for row_idx, r_data in enumerate(summary_rows, start=2):
        ws_sum.row_dimensions[row_idx].height = 20
        ws_sum.append(r_data)
        for col_idx in range(1, 4):
            c = ws_sum.cell(row=row_idx, column=col_idx)
            c.border = cell_border
            c.alignment = center_align if col_idx > 1 else left_align

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_leave_pdf_report(
    records: List[LeaveRequest],
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department_name: str = "All",
) -> bytes:
    """Generate enterprise PDF report for leave & permission requests using ReportLab."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "LeaveTitle",
        parent=styles["Title"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#064E3B"),
        fontName="Helvetica-Bold",
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "LeaveSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748B"),
        fontName="Helvetica",
    )
    meta_style = ParagraphStyle(
        "LeaveMeta",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
        fontName="Helvetica",
    )
    table_cell_style = ParagraphStyle(
        "LeaveCell",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
        fontName="Helvetica",
    )
    table_header_style = ParagraphStyle(
        "LeaveHeader",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        fontName="Helvetica-Bold",
        alignment=1,
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph("APEXATTEND ENTERPRISE — LEAVE & PERMISSIONS AUDIT REPORT", title_style))
    elements.append(Paragraph("Biometric Time & Attendance • Official Compliance Ledger & Human Resources Time-Off Audit", subtitle_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#064E3B"), spaceAfter=10))

    # Calculate Breakdown of Leaves Taken (Approved)
    total_records = len(records)
    approved_records = [r for r in records if r.status == "APPROVED"]
    casual_taken = sum(1 for r in approved_records if r.leave_type == "CASUAL")
    sick_taken = sum(1 for r in approved_records if r.leave_type == "SICK")
    annual_taken = sum(1 for r in approved_records if r.leave_type == "ANNUAL")
    emergency_taken = sum(1 for r in approved_records if r.leave_type == "EMERGENCY")
    perm_taken = sum(1 for r in approved_records if r.request_type == "PERMISSION")
    rejected_count = sum(1 for r in records if r.status == "REJECTED")
    pending_count = sum(1 for r in records if r.status in ("PENDING", "ENQUIRY_REQUESTED"))

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    date_range_str = f"{start_date or 'Beginning'} to {end_date or 'Present'}"

    # KPI / Metadata box
    meta_data = [
        [
            Paragraph(f"<b>Audit Date Range:</b> {date_range_str}", meta_style),
            Paragraph(f"<b>Department Scope:</b> {department_name}", meta_style),
            Paragraph(f"<b>Generated At:</b> {now_str}", meta_style),
        ],
        [
            Paragraph(f"<b>Total Requests:</b> {total_records} (Approved: {len(approved_records)} | Rejected: {rejected_count} | Pending: {pending_count})", meta_style),
            Paragraph(f"<b>Leaves Taken (Approved):</b> Casual: {casual_taken} | Medical/Sick: {sick_taken} | Annual: {annual_taken} | Emergency: {emergency_taken}", meta_style),
            Paragraph(f"<b>Permissions Granted:</b> {perm_taken} outings", meta_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[240, 310, 170])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#86EFAC")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # Table of Records
    col_headers = [
        "Ref #",
        "Emp ID",
        "Employee Name",
        "Department",
        "Type",
        "Schedule & Duration",
        "Status",
        "Reason / Notes",
        "Decision By",
    ]
    table_rows = [[Paragraph(h, table_header_style) for h in col_headers]]

    for rec in records:
        f = _extract_leave_fields(rec)
        reason_txt = f["reason"]
        if f["admin_notes"]:
            reason_txt += f"<br/><font color='#059669'><b>Note:</b> {f['admin_notes']}</font>"

        table_rows.append([
            Paragraph(f["id"], table_cell_style),
            Paragraph(f["employee_id"], table_cell_style),
            Paragraph(f["employee_name"], table_cell_style),
            Paragraph(f["department"], table_cell_style),
            Paragraph(f"<b>{f['leave_type']}</b><br/><font color='#64748B'>{f['request_type']}</font>", table_cell_style),
            Paragraph(f"{f['schedule']}<br/><font color='#059669'><b>{f['duration']}</b></font>", table_cell_style),
            Paragraph(f"<b>{f['status']}</b>", table_cell_style),
            Paragraph(reason_txt, table_cell_style),
            Paragraph(f["reviewer"], table_cell_style),
        ])

    if total_records == 0:
        no_data_para = Paragraph("No leave or permission records found matching the specified filters.", meta_style)
        table_rows.append([no_data_para] + [Paragraph("", table_cell_style) for _ in range(len(col_headers) - 1)])

    col_widths = [45, 60, 100, 80, 75, 110, 65, 120, 85]
    rec_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    rec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#064E3B")),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(rec_table)

    doc.build(elements)
    return buf.getvalue()


def generate_leave_report(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    leave_type: Optional[str] = None,
    search: Optional[str] = None,
    report_format: str = "csv",
) -> Tuple[bytes, str, str]:
    """Query leave database with filters and export report in CSV, XLSX, or PDF."""
    query = (
        db.query(LeaveRequest)
        .join(User, LeaveRequest.user_id == User.id)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
    )

    if start_date:
        query = query.filter(LeaveRequest.end_date >= start_date)
    if end_date:
        query = query.filter(LeaveRequest.start_date <= end_date)

    dept_name = "All Departments"
    if department_id:
        query = query.filter(User.department_id == department_id)
        dept_obj = db.query(Department).filter(Department.id == department_id).first()
        if dept_obj:
            dept_name = dept_obj.name

    if employee_id and employee_id.strip():
        term = f"%{employee_id.strip()}%"
        query = query.filter(
            or_(
                User.employee_id.ilike(term),
                User.full_name.ilike(term),
            )
        )

    if status and status.strip() and status.strip().upper() != "ALL":
        query = query.filter(LeaveRequest.status == status.strip().upper())

    if request_type and request_type.strip() and request_type.strip().upper() != "ALL":
        query = query.filter(LeaveRequest.request_type == request_type.strip().upper())

    if leave_type and leave_type.strip() and leave_type.strip().upper() != "ALL":
        query = query.filter(LeaveRequest.leave_type == leave_type.strip().upper())

    if search and search.strip():
        s_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(s_term),
                User.employee_id.ilike(s_term),
                LeaveRequest.reason.ilike(s_term),
                LeaveRequest.admin_notes.ilike(s_term),
            )
        )

    records = query.order_by(LeaveRequest.created_at.desc()).all()

    fmt = report_format.lower().strip()
    now_stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if fmt in ("xlsx", "excel"):
        content = generate_leave_excel_report(records)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"apexattend_leaves_{now_stamp}.xlsx"
    elif fmt == "pdf":
        content = generate_leave_pdf_report(records, start_date, end_date, department_name=dept_name)
        media_type = "application/pdf"
        filename = f"apexattend_leaves_{now_stamp}.pdf"
    else:
        content = generate_leave_csv_report(records)
        media_type = "text/csv; charset=utf-8"
        filename = f"apexattend_leaves_{now_stamp}.csv"

    return content, media_type, filename
