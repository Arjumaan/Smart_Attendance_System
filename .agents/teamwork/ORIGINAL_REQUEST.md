# Original User Request

## 2026-10-26T12:04:43Z

Enterprise Smart Attendance System using real-time facial recognition to automate presence tracking, dual check-in/check-out, working hours calculation, and analytics for corporate employees across enterprise offices and facilities.

Requested team: Lead-Orchestrator with parallel specialist agents (AI Engineer, Backend Architect, Frontend Developer, Privacy Engineer, DevOps & QA)

Working directory: D:\My Projects\Smart_Attendance_System
Integrity mode: development

## Requirements

### R1. Employee Enrollment & Biometric Security
The system must allow HR and system administrators to enroll corporate employees with their Employee ID, Name, Department, and facial biometric data. Raw facial embeddings (512-dimensional vectors) must be encrypted at rest (AES-256) and never stored as raw plaintext vectors. Role-based access control (RBAC) must restrict administrative functions to HR/Admin, departmental reports to Department Managers/Supervisors, and personal records to Employees.

### R2. Real-Time Face Recognition & Anti-Spoofing Engine
The system must detect faces in incoming video frames and match them against enrolled employee biometric vectors using cosine similarity with a high-confidence threshold (>= 0.75). The engine must include anti-spoofing/liveness verification to reject printed photographs and digital screen displays.

### R3. Dual Check-In & Check-Out Tracking Logic
The system must record the first daily face recognition event as "Check-In". Any subsequent detection after a configurable cooldown period (e.g. 5 minutes) must register as "Check-Out", updating the employee's total working hours. Check-in timestamps after a scheduled shift start (e.g., 09:15 AM) must be automatically flagged as "Late".

### R4. Hybrid Camera Video Ingestion
The system must support two input modalities:
1. Browser-based kiosk stream (WebRTC/HTML5 video capture) running on front-desk laptops and tablets.
2. An edge/server-side OpenCV runner script that continuously reads RTSP IP camera streams or USB CCTV cameras and forwards detected face frames to the recognition pipeline.

### R5. Interactive Enterprise Dashboard & Kiosk UI
The frontend must provide:
1. A fullscreen Live Attendance Kiosk showing real-time camera feed, recognition bounding boxes, and immediate audible/visual attendance confirmation toasts ("Welcome [Employee Name] - Checked In at [Time]").
2. An Admin Analytics Dashboard displaying daily attendance rates, total present/late/absent counts, 30-day attendance trends, and department breakdown charts.
3. An Employee Management interface for employee registration, manual attendance adjustments, and facial re-enrollment.

### R6. Enterprise Attendance Report Generator
The system must generate downloadable attendance reports in CSV, Microsoft Excel (.xlsx), and PDF formats, with filtering by date range, department, employee ID, and attendance status (Present, Late, Absent, Early Departure).

---

## Acceptance Criteria

### Biometrics & Security Verification
- [ ] Automated tests in tests/test_face_engine.py verify face detection and embedding extraction on test portrait images.
- [ ] Embedding cosine similarity distinguishes matching identities (> 0.75) from non-matching identities (< 0.40).
- [ ] Automated tests in tests/test_security.py confirm that stored biometric vectors in the database are encrypted ciphertext and cannot be decrypted without the secret encryption key.
- [ ] RBAC middleware denies unauthorized roles from accessing administrative endpoints (returns HTTP 403 Forbidden).

### Attendance Engine Verification
- [ ] Automated tests in tests/test_attendance_logic.py verify that an employee's first detection creates a Check-In record.
- [ ] Detections within the 5-minute cooldown window are suppressed as duplicate check-in events.
- [ ] Detections occurring after the cooldown window update the Check-Out timestamp and compute total duration in hours.
- [ ] Detections after the shift cutoff time (09:15 AM) have is_late set to True.

### Report Generation Verification
- [ ] Calling the export endpoint with date range and department filters generates valid, non-empty CSV, Excel (.xlsx), and PDF files containing expected headers and employee attendance records.

### End-to-End Build & Run Verification
- [ ] Backend starts without runtime errors and passes pytest tests/.
- [ ] Frontend builds cleanly with zero TypeScript/Vite compilation errors (npm run build).
- [ ] Edge CCTV runner script (scripts/cctv_attendance.py) initializes OpenCV video capture and accepts test video streams without crashing.
