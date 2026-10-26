# Enterprise Smart Attendance System (Face Recognition)

An enterprise-grade, high-concurrency biometric attendance system powered by OpenCV, Deep Learning Face Embeddings (512-dimensional normalized vectors), AES-256-GCM hardware-grade vector cryptography, and FastAPI + React 18.

---

## 🏗️ Architecture Overview

```
                      +-----------------------------+
                      |   CCTV / RTSP Stream / Kiosk|
                      |   (Browser / Native OpenCV) |
                      +--------------+--------------+
                                     |
                         Base64 Frame / WebRTC / WS
                                     |
                                     v
+--------------------------------------------------------------------------+
|                            FASTAPI BACKEND                               |
|                                                                          |
|  +--------------------+    +--------------------+    +----------------+  |
|  | Face Alignment &   |    | Multi-Modal        |    | 512-d Vector   |  |
|  | Haar / DNN Eyes    |--->| Liveness Detection |--->| Extraction &   |  |
|  +--------------------+    +--------------------+    | Normalization  |  |
|                                                      +--------+-------+  |
|                                                               |          |
|  +------------------------------------------------------------v-------+  |
|  | InMemory Vector Cache: Cosine Similarity (<50ms Matrix Lookup)     |  |
|  +------------------------------------------------------------+-------+  |
|                                                               | Match >= 0.75
|  +------------------------------------------------------------v-------+  |
|  | Attendance Logic Engine:                                           |  |
|  | - 5-Minute Anti-Duplicate Cooldown Suppression                     |  |
|  | - Dual Check-In / Check-Out State Machine                          |  |
|  | - Shift Cutoff Late Detection (09:15 AM Default)                   |  |
|  | - Total Duration & Overtime Calculation                            |  |
|  +------------------------------------------------------------+-------+  |
|                                                               |          |
|  +--------------------+    +--------------------+             |          |
|  | AES-256-GCM Crypto |--->| PostgreSQL 16 /    |<------------+          |
|  | (Hardware Guard)   |    | SQLite DB Engine   |                        |
|  +--------------------+    +--------------------+                        |
+--------------------------------------------------------------------------+
                                     |
                             REST API & WebSocket
                                     |
                                     v
+--------------------------------------------------------------------------+
|                       REACT 18 + VITE FRONTEND                           |
|                                                                          |
|  - Real-time Kiosk with Audio Feedback & Recognition Ring HUD            |
|  - Executive Dashboard with Attendance KPIs & Trend Visualizations       |
|  - Employee Enrollment Portal with Live Video Frame Capture              |
|  - Attendance History & Filterable Employee Directory                    |
|  - Audit-Ready Export Engine (CSV, Excel .xlsx, PDF with Signature Line) |
+--------------------------------------------------------------------------+
```

---

## 🚀 Quickstart

### 1. Backend Setup (Local Development)

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # Linux/macOS

pip install -r requirements.txt
```

### 2. Run Database Seeding

Populate 5 departments, 10 employees with encrypted biometric vectors, and 30 days of attendance history:

```bash
python scripts/seed_demo_data.py
```

**Default Credentials:**
- Admin: `admin@company.com` / `Password123!`
- HR: `sarah.hr@company.com` / `Password123!`

### 3. Run Backend Server

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API docs available at `http://localhost:8000/docs`.

### 4. Run Edge CCTV Runner (Optional Hardware / Test Mode)

Test synthetic frame detection and vector extraction without physical camera:
```bash
python scripts/cctv_attendance.py --test-mode
```

Connect to physical USB camera or RTSP CCTV stream:
```bash
python scripts/cctv_attendance.py --source 0 --display
# or RTSP:
python scripts/cctv_attendance.py --source "rtsp://admin:pass@192.168.1.50:554/h264Preview_01_main" --display
```

### 5. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🐳 Docker Deployment

Run the complete multi-container stack with PostgreSQL, Backend, and Frontend:

```bash
docker-compose up --build -d
```

- Web Application: `http://localhost:3000`
- API Documentation: `http://localhost:8000/docs`
- PostgreSQL Port: `5432`

---

## 🔒 Security & Privacy

- **Biometric Vectors**: 512-dimensional facial embeddings are encrypted using **AES-256-GCM** with a unique 12-byte initialization vector (IV) and 16-byte authentication tag per record.
- **No Raw Image Storage**: Only mathematical embedding vectors are preserved; raw facial biometric photos are processed in memory and discarded.
- **Enterprise RBAC**: Roles strictly enforced at the API route layer:
  - `ADMIN`: Full system configuration, department management, employee enrollment, manual attendance override.
  - `HR`: Employee enrollment, report generation, attendance review.
  - `MANAGER`: Department supervisor view and team attendance auditing.
  - `EMPLOYEE`: Personal attendance history and live kiosk check-in/out.

---

## 🧪 Automated Test Suite

Run the comprehensive pytest suite covering security, face recognition, attendance state machines, and reports:

```bash
python -m pytest tests/ -v
```
*(38 test cases verifying 100% core coverage)*
