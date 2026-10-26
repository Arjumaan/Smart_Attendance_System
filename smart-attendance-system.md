# Smart Attendance System - Enterprise Implementation Roadmap

## Overview
AI-powered Enterprise Smart Attendance System using Face Recognition with FastAPI backend, React (Vite + Tailwind CSS) frontend, PostgreSQL database, and hybrid camera capture (browser WebRTC kiosk + native OpenCV CCTV script). Built strictly for corporate enterprise use (Employees, Department Managers, Admin/HR).

---

## Assigned Specialist Agents & Path Boundaries
- **Lead Orchestrator**: `Agents Orchestrator` / `Software Architect` (Project root & coordination)
- **Agent 1 (AI & Biometrics)**: `AI Engineer` (`backend/app/ml/`, `backend/app/services/face_engine.py`, `backend/app/services/liveness.py`)
- **Agent 2 (Backend & Database)**: `Backend Architect` (`backend/app/api/`, `backend/app/db/`, `backend/app/models/`, `backend/app/services/reports.py`)
- **Agent 3 (Frontend & Dashboard)**: `Frontend Developer` (`frontend/`)
- **Agent 4 (Security & Biometric Privacy)**: `Privacy Engineer` (`backend/app/core/security.py`, `backend/app/core/encryption.py`)
- **Agent 5 (DevOps & Edge CCTV)**: `DevOps Automator` / `Test Automation Engineer` (`docker-compose.yml`, `scripts/cctv_attendance.py`, `tests/`)

---

## Phase Checklist

### Phase 1: Environment & Core Data Foundation
- [ ] Initialize project directory structure and `.env.example`
- [ ] Set up Docker Compose for PostgreSQL
- [ ] Define SQLAlchemy database models (`User`, `Department`, `AttendanceLog`, `FaceEmbedding`)
- [ ] Implement AES-256 biometric vector encryption and JWT authentication

### Phase 2: Biometric Engine & Anti-Spoofing
- [ ] Build face detection & alignment pipeline (OpenCV DNN / MediaPipe / MTCNN)
- [ ] Implement embedding extractor (FaceNet / DeepFace 512-d normalized vectors)
- [ ] Implement anti-spoofing / liveness detection (Blink / Eye-Aspect-Ratio + motion)
- [ ] Build in-memory embedding cache for sub-50ms identification lookups

### Phase 3: Dual Attendance Tracking Logic & APIs
- [ ] Implement Check-In / Check-Out state machine with cooldown window
- [ ] Implement late arrival calculation (configurable cutoff e.g., 09:15 AM)
- [ ] Build REST & WebSocket endpoints (`/enroll`, `/mark-frame`, `/attendance/logs`, `/reports/export`)
- [ ] Implement CSV, Excel, and PDF report generators

### Phase 4: Hybrid Camera Ingestion & Frontend UI
- [ ] Scaffold React 18 + Vite + Tailwind CSS application
- [ ] Build Live Attendance Kiosk with WebRTC camera and real-time bounding box feedback
- [ ] Build User Enrollment modal with multi-angle capture guidance
- [ ] Build Admin Analytics Dashboard with KPI cards, attendance trends, and late entry charts
- [ ] Build Native OpenCV CCTV edge runner script (`scripts/cctv_attendance.py`)

### Phase 5: Verification & End-to-End Testing
- [ ] Unit tests for facial embedding similarity and liveness checks (`tests/test_face_engine.py`)
- [ ] Integration tests for Check-In / Check-Out flow and anti-duplicate cooldown (`tests/test_attendance_logic.py`)
- [ ] Biometric vector encryption verification (`tests/test_security.py`)
- [ ] System documentation in `README.md`
