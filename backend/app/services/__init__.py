"""Services package for Smart Attendance System.

Includes facial recognition biometrics, anti-spoofing liveness verification,
attendance business logic, and enterprise report generators.
"""

from backend.app.services.attendance_service import (
    get_daily_summary,
    get_employee_status,
    mark_manual_attendance,
    record_attendance_event,
)
from backend.app.services.face_engine import (
    EmbeddingCache,
    FaceCrop,
    compute_cosine_similarity,
    compute_embedding,
    default_cache,
    detect_and_align,
    match_embedding,
)
from backend.app.services.liveness import verify_liveness
from backend.app.services.reports import (
    generate_csv_report,
    generate_excel_report,
    generate_pdf_report,
    generate_report,
)

__all__ = [
    "FaceCrop",
    "detect_and_align",
    "compute_embedding",
    "compute_cosine_similarity",
    "EmbeddingCache",
    "default_cache",
    "match_embedding",
    "verify_liveness",
    "record_attendance_event",
    "get_daily_summary",
    "get_employee_status",
    "mark_manual_attendance",
    "generate_csv_report",
    "generate_excel_report",
    "generate_pdf_report",
    "generate_report",
]

