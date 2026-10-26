# Project: Enterprise Smart Attendance System

## Architecture
The Enterprise Smart Attendance System is an end-to-end biometrics and attendance management platform consisting of:
1. **Core Biometrics & AI Engine (`backend/app/ml/`, `backend/app/services/face_engine.py`, `backend/app/services/liveness.py`)**:
   - Face detection, facial landmark alignment, 512-dimensional normalized embedding generation.
   - Cosine similarity matching against enrolled vector embeddings (threshold >= 0.75).
   - Anti-spoofing and liveness verification (texture analysis, eye-blink / aspect ratio, motion analysis) to reject printed photos and digital screens.
   - In-memory vector cache for sub-50ms identification speed.
2. **Security & Privacy Layer (`backend/app/core/security.py`, `backend/app/core/encryption.py`)**:
   - AES-256 encryption at rest for all 512-d biometric vectors using cryptographic keys managed via environment configuration.
   - Passwords hashed with bcrypt.
   - JWT authentication and Role-Based Access Control (RBAC): `ADMIN` / `HR`, `MANAGER`, `EMPLOYEE`.
3. **Database & Data Layer (`backend/app/db/`, `backend/app/models/`)**:
   - SQLAlchemy ORM with PostgreSQL support (and SQLite fallback for zero-dependency standalone testing).
   - Models: `User`, `Department`, `FaceEmbedding`, `AttendanceLog`, `AuditLog`.
4. **Attendance State Machine & Business Logic (`backend/app/services/attendance_service.py`, `backend/app/services/reports.py`)**:
   - Dual check-in / check-out state engine with configurable cooldown window (default 5 minutes).
   - First detection of the day -> Check-In. Detections within cooldown -> ignored duplicate. Detections after cooldown -> Check-Out updated, total hours computed.
   - Shift start cutoff logic (e.g. 09:15 AM) automatically setting `is_late = True`.
   - Report generation service for CSV, Excel (.xlsx using openpyxl), and PDF (ReportLab).
5. **FastAPI Application & API Gateway (`backend/app/api/`)**:
   - RESTful endpoints for Authentication, Employee Management, Biometric Enrollment, Attendance Records, and Report Downloads.
   - WebSocket / Stream endpoint for live kiosk frame evaluation and real-time event broadcasting.
6. **Frontend Kiosk & Admin Dashboard (`frontend/`)**:
   - React 18, Vite, Tailwind CSS, Lucide Icons, Recharts.
   - Live Attendance Kiosk with browser WebRTC video capture, bounding box canvas overlay, and visual/audio confirmation toasts.
   - Admin Analytics Dashboard with KPI statistics (Present, Late, Absent), 30-day trend charts, department breakdown.
   - Employee Management UI with enrollment modal and manual adjustment workflows.
7. **Hybrid Ingestion & Edge CCTV Runner (`scripts/cctv_attendance.py`)**:
   - Independent OpenCV video processor for RTSP streams or local webcams/video files.
   - Local frame decimation, face detection, and API dispatch to backend recognition endpoints.
8. **Automated Verification Test Suite (`tests/`)**:
   - Unit and integration tests covering face recognition, encryption, RBAC, state machine logic, and report generation.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Biometric Vector Encryption (AES-256) | Encrypt 512-d biometric embeddings at rest with AES-256 before saving to DB; decrypt during caching/matching | M1 | ORIGINAL_REQUEST §R1 |
| 2 | RBAC Security & JWT Authentication | Role-based authorization (`ADMIN`/`HR`, `MANAGER`, `EMPLOYEE`), secure JWT token generation, permission verification middleware | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Core Database Schema & Models | SQLAlchemy models: `User`, `Department`, `FaceEmbedding`, `AttendanceLog`, `AuditLog` | M1 | ORIGINAL_REQUEST §R1, R3 |
| 4 | Face Detection & Alignment Pipeline | Detect facial bounding boxes and landmarks for normalization across portrait and camera frames | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Embedding Extraction & Cosine Matcher | Extract 512-d normalized vectors, calculate cosine similarity (match threshold >= 0.75, non-match < 0.40) | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Anti-Spoofing & Liveness Engine | Reject photo printouts and digital screens using frequency/texture and eye/blink motion heuristics | M2 | ORIGINAL_REQUEST §R2 |
| 7 | In-Memory Embedding Cache | Cache decrypted embeddings in memory for sub-50ms matching latency | M2 | smart-attendance-system.md §Phase 2 |
| 8 | Check-In / Check-Out State Machine | First daily event = Check-In; subsequent events after cooldown = Check-Out updating duration in hours | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Cooldown Suppression Window | Configurable 5-minute cooldown where duplicate detections are safely suppressed | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Late Arrival Flagging | Automatic detection and marking of late check-ins after configurable shift start (09:15 AM) | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Attendance REST & WebSocket APIs | Full FastAPI endpoints for enrollment, recognition, attendance logs, dashboard stats, and real-time feeds | M3 | ORIGINAL_REQUEST §R1, R3, R4 |
| 12 | Enterprise Report Generator | Export reports in CSV, Excel (.xlsx), and PDF formats with date range and department filters | M3 | ORIGINAL_REQUEST §R6 |
| 13 | Fullscreen Live Attendance Kiosk | WebRTC camera feed, bounding boxes, instant audible/visual confirmation toasts | M4 | ORIGINAL_REQUEST §R4, R5 |
| 14 | Admin Analytics Dashboard | KPIs (Present, Late, Absent), 30-day attendance trends, department breakdowns | M4 | ORIGINAL_REQUEST §R5 |
| 15 | Employee Management & Enrollment UI | Registration, manual attendance adjustments, and webcam-based face enrollment | M4 | ORIGINAL_REQUEST §R5 |
| 16 | Edge/CCTV OpenCV Runner Script | `scripts/cctv_attendance.py` for headless RTSP/USB CCTV stream ingestion and API forwarding | M5 | ORIGINAL_REQUEST §R4 |
| 17 | Docker & Environment Configuration | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `.env.example` | M5 | smart-attendance-system.md §Phase 1 |
| 18 | Automated Test Suite & Pytest Verification | `tests/test_face_engine.py`, `tests/test_security.py`, `tests/test_attendance_logic.py`, `tests/test_reports.py` | M5 | ORIGINAL_REQUEST §Acceptance Criteria |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Security, Encryption & Database Foundation | Implement `backend/app/core/encryption.py` (AES-256 for embeddings), `backend/app/core/security.py` (JWT & RBAC), `backend/app/db/` & `backend/app/models/` (User, Department, FaceEmbedding, AttendanceLog) | none | DONE |
| M2 | Biometric Engine & Anti-Spoofing | Implement `backend/app/ml/`, `backend/app/services/face_engine.py`, and `backend/app/services/liveness.py` (Face detection, 512-d embedding extraction, cosine similarity, anti-spoofing, in-memory cache) | M1 | DONE |
| M3 | Attendance State Machine, Reports & FastAPI Gateway | Implement `backend/app/services/attendance_service.py` (cooldown, late detection, check-in/out), `backend/app/services/reports.py` (CSV, XLSX, PDF), and `backend/app/api/` (REST & WebSocket routes) | M1, M2 | DONE |
| M4 | Frontend Kiosk, WebRTC & Admin Dashboard | Implement `frontend/` (React 18 + Vite + Tailwind CSS), Live Attendance Kiosk with WebRTC & toasts, Admin Analytics Dashboard, Employee Management | M3 | PLANNED |
| M5 | Edge CCTV Runner, Docker & Automated Test Suite | Implement `scripts/cctv_attendance.py`, `docker-compose.yml`, and comprehensive tests in `tests/test_face_engine.py`, `tests/test_security.py`, `tests/test_attendance_logic.py`, `tests/test_reports.py` | M1, M2, M3 | PLANNED |
| M6 | Final Acceptance Verification & E2E Validation | Execute all pytest tests, build frontend, test CCTV script runner, verify all criteria in ORIGINAL_REQUEST.md | M1-M5 | PLANNED |

---

## Interface Contracts

### 1. Biometrics Encryption & Storage (`backend/app/core/encryption.py` ↔ `backend/app/models/`)
- `encrypt_embedding(vector: list[float] | np.ndarray) -> str`: Serializes 512-d float array to bytes, encrypts via AES-256-CBC/GCM, returns base64 ciphertext string.
- `decrypt_embedding(ciphertext: str) -> np.ndarray`: Decrypts base64 ciphertext using secret key, deserializes to 512-d float32 numpy array.
- In-database storage format: `FaceEmbedding.encrypted_embedding: Text` storing ciphertext only.

### 2. Biometric Engine ↔ Attendance Engine
- `face_engine.detect_and_align(image: np.ndarray) -> list[FaceCrop]`: Returns detected face bounding boxes and normalized aligned face crops.
- `face_engine.compute_embedding(face_crop: np.ndarray) -> np.ndarray`: Produces 512-d unit-normalized embedding vector.
- `face_engine.match_embedding(query_vector: np.ndarray, threshold: float = 0.75) -> tuple[int | None, float]`: Matches against in-memory cached vectors, returns `(employee_id, similarity_score)`.
- `liveness.verify_liveness(image_or_frames: np.ndarray | list[np.ndarray]) -> tuple[bool, float, str]`: Returns `(is_real, score, reason)`.

### 3. Attendance Service ↔ API Endpoints
- `record_attendance_event(db: Session, employee_id: int, timestamp: datetime, source: str) -> AttendanceResult`:
  - Returns `AttendanceResult(status: "CHECKED_IN" | "CHECKED_OUT" | "COOLDOWN_IGNORED", is_late: bool, duration_hours: float | None, employee: UserSummary)`.
- `get_daily_summary(db: Session, target_date: date) -> DailyStats`:
  - Returns total present, absent, late counts, and department-level aggregations.
- `generate_report(db: Session, start_date: date, end_date: date, department_id: int | None, format: str) -> bytes`:
  - Generates binary payload for CSV, XLSX, or PDF.

---

## Code Layout
```
Smart_Attendance_System/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── employees.py
│   │   │   │   ├── biometrics.py
│   │   │   │   ├── attendance.py
│   │   │   │   └── reports.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── encryption.py
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py
│   │   │   └── base.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── department.py
│   │   │   ├── face_embedding.py
│   │   │   └── attendance.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── biometrics.py
│   │   │   ├── attendance.py
│   │   │   └── reports.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── face_engine.py
│   │       ├── liveness.py
│   │       ├── attendance_service.py
│   │       └── reports.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Kiosk.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Employees.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── Toast.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── index.html
├── scripts/
│   ├── __init__.py
│   └── cctv_attendance.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_face_engine.py
│   ├── test_security.py
│   ├── test_attendance_logic.py
│   └── test_reports.py
├── docker-compose.yml
├── .env.example
├── smart-attendance-system.md
└── PROJECT.md
```
