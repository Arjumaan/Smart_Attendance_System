"""Enterprise Demo Data Seeder for Smart Attendance System.

Populates the database with:
1. Five Enterprise Departments (Engineering, HR, Sales, Finance, Operations).
2. Users across RBAC roles: Admin, HR Manager, Department Managers, and Employees.
3. AES-256 encrypted 512-dimensional facial biometric embeddings.
4. Realistic 30-day attendance history (Present, Late, and Half-day events) for dashboard analytics.

Usage:
    python scripts/seed_demo_data.py
"""

from datetime import date, datetime, time, timedelta, timezone
import logging
import os
import random
import sys
from typing import Dict, List

import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.core.encryption import encrypt_embedding
from backend.app.core.security import UserRole, get_password_hash
from backend.app.db.base import Base
from backend.app.db.session import SessionLocal, engine
from backend.app.models.attendance import AttendanceLog
from backend.app.models.department import Department
from backend.app.models.face_embedding import FaceEmbedding
from backend.app.models.user import User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("SeedData")


DEPARTMENTS_DATA = [
    {
        "name": "Engineering",
        "code": "ENG",
        "description": "Software Engineering, AI Research, and Cloud Infrastructure",
    },
    {
        "name": "Human Resources",
        "code": "HR",
        "description": "People Operations, Talent Acquisition, and Employee Experience",
    },
    {
        "name": "Sales",
        "code": "SAL",
        "description": "Enterprise Solutions, Global Accounts, and Client Partnerships",
    },
    {
        "name": "Finance",
        "code": "FIN",
        "description": "Corporate Accounting, Financial Planning, and Regulatory Audit",
    },
    {
        "name": "Operations",
        "code": "OPS",
        "description": "Workplace Facilities, Logistics, and IT Support Services",
    },
]

USERS_DATA = [
    {
        "employee_id": "EMP001",
        "full_name": "System Administrator",
        "email": "admin@company.com",
        "role": UserRole.ADMIN.value,
        "department_code": "HR",
        "shift_start": "09:00",
        "seed_idx": 101,
    },
    {
        "employee_id": "EMP002",
        "full_name": "Sarah Jenkins",
        "email": "sarah.hr@company.com",
        "role": UserRole.HR.value,
        "department_code": "HR",
        "shift_start": "09:15",
        "seed_idx": 102,
    },
    {
        "employee_id": "EMP003",
        "full_name": "Alex Rivera",
        "email": "alex.eng@company.com",
        "role": UserRole.MANAGER.value,
        "department_code": "ENG",
        "shift_start": "09:15",
        "seed_idx": 103,
    },
    {
        "employee_id": "EMP004",
        "full_name": "Michael Chang",
        "email": "michael.sal@company.com",
        "role": UserRole.MANAGER.value,
        "department_code": "SAL",
        "shift_start": "09:30",
        "seed_idx": 104,
    },
    {
        "employee_id": "EMP005",
        "full_name": "Dave Miller",
        "email": "dave.eng@company.com",
        "role": UserRole.EMPLOYEE.value,
        "department_code": "ENG",
        "shift_start": "09:15",
        "seed_idx": 105,
    },
    {
        "employee_id": "EMP006",
        "full_name": "Elena Rostova",
        "email": "elena.eng@company.com",
        "role": UserRole.EMPLOYEE.value,
        "department_code": "ENG",
        "shift_start": "09:00",
        "seed_idx": 106,
    },
    {
        "employee_id": "EMP007",
        "full_name": "Priya Sharma",
        "email": "priya.hr@company.com",
        "role": UserRole.EMPLOYEE.value,
        "department_code": "HR",
        "shift_start": "09:15",
        "seed_idx": 107,
    },
    {
        "employee_id": "EMP008",
        "full_name": "James Wilson",
        "email": "james.sal@company.com",
        "role": UserRole.EMPLOYEE.value,
        "department_code": "SAL",
        "shift_start": "09:30",
        "seed_idx": 108,
    },
    {
        "employee_id": "EMP009",
        "full_name": "Lisa Vance",
        "email": "lisa.fin@company.com",
        "role": UserRole.EMPLOYEE.value,
        "department_code": "FIN",
        "shift_start": "09:00",
        "seed_idx": 109,
    },
    {
        "employee_id": "EMP010",
        "full_name": "Carlos Gomez",
        "email": "carlos.ops@company.com",
        "role": UserRole.EMPLOYEE.value,
        "department_code": "OPS",
        "shift_start": "08:30",
        "seed_idx": 110,
    },
]


def generate_synthetic_embedding(seed: int) -> np.ndarray:
    """Generate a reproducible, unit-normalized 512-dimensional vector."""
    rng = np.random.RandomState(seed)
    vec = rng.randn(512).astype(np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 1e-8 else vec


def seed_database() -> None:
    """Execute complete database seeding."""
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Departments
        dept_map: Dict[str, Department] = {}
        for d_info in DEPARTMENTS_DATA:
            dept = db.query(Department).filter(Department.code == d_info["code"]).first()
            if not dept:
                dept = Department(
                    name=d_info["name"],
                    code=d_info["code"],
                    description=d_info["description"],
                )
                db.add(dept)
                db.commit()
                db.refresh(dept)
                logger.info(f"Created Department: {dept.name} ({dept.code})")
            dept_map[dept.code] = dept

        # 2. Seed Users & Biometric Embeddings
        seeded_users: List[User] = []
        default_pwd_hash = get_password_hash("Password123!")

        for u_info in USERS_DATA:
            user = db.query(User).filter(User.employee_id == u_info["employee_id"]).first()
            dept = dept_map.get(u_info["department_code"])
            dept_id = dept.id if dept else None

            if not user:
                user = User(
                    employee_id=u_info["employee_id"],
                    full_name=u_info["full_name"],
                    email=u_info["email"],
                    hashed_password=default_pwd_hash,
                    role=u_info["role"],
                    department_id=dept_id,
                    is_active=True,
                    shift_start=u_info["shift_start"],
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"Created User: {user.full_name} ({user.employee_id}) [{user.role}]")

            seeded_users.append(user)

            emb_record = db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user.id).first()
            if not emb_record:
                vec = generate_synthetic_embedding(u_info["seed_idx"])
                encrypted_token = encrypt_embedding(vec)
                emb_record = FaceEmbedding(
                    user_id=user.id,
                    encrypted_embedding=encrypted_token,
                    embedding_version="facenet-512-v1",
                )
                db.add(emb_record)
                db.commit()
                logger.info(f"Enrolled AES-256 Biometric Vector for: {user.employee_id}")

        # 3. Seed 30-Day Attendance History
        logger.info("Generating realistic 30-day attendance history...")
        today = date.today()
        seeded_logs_count = 0

        sim_random = random.Random(2026)

        for days_ago in range(30, -1, -1):
            curr_date = today - timedelta(days=days_ago)

            # Skip weekends
            if curr_date.weekday() >= 5:
                continue

            for user in seeded_users:
                existing = (
                    db.query(AttendanceLog)
                    .filter(AttendanceLog.user_id == user.id, AttendanceLog.date == curr_date)
                    .first()
                )
                if existing:
                    continue

                if sim_random.random() < 0.05:
                    continue

                sh_hour, sh_min = map(int, user.shift_start.split(":"))

                is_late_case = sim_random.random() < 0.15

                if is_late_case:
                    delay_mins = sim_random.randint(15, 45)
                    check_in_dt = datetime.combine(
                        curr_date, time(sh_hour, sh_min)
                    ) + timedelta(minutes=delay_mins)
                    status = "LATE"
                    is_late = True
                else:
                    early_mins = sim_random.randint(2, 25)
                    check_in_dt = datetime.combine(
                        curr_date, time(sh_hour, sh_min)
                    ) - timedelta(minutes=early_mins)
                    status = "PRESENT"
                    is_late = False

                work_hours = round(sim_random.uniform(8.0, 9.4), 2)
                check_out_dt = check_in_dt + timedelta(hours=work_hours)

                src_val = sim_random.choice(["KIOSK", "CCTV", "KIOSK", "CCTV", "MANUAL"])

                log_entry = AttendanceLog(
                    user_id=user.id,
                    date=curr_date,
                    check_in_time=check_in_dt,
                    check_out_time=check_out_dt,
                    total_hours=work_hours,
                    status=status,
                    is_late=is_late,
                    source=src_val,
                    notes=f"Simulated {status.lower()} record via {src_val}",
                )
                db.add(log_entry)
                seeded_logs_count += 1

        db.commit()
        logger.info(f"Successfully generated {seeded_logs_count} attendance records.")
        logger.info("==================================================================")
        logger.info("DEMO SEED COMPLETED:")
        logger.info("  Admin: admin@company.com / Password123!")
        logger.info("  HR:    sarah.hr@company.com / Password123!")
        logger.info("  Total Enrolled Employees: 10")
        logger.info("  Historical Attendance Window: 30 days")
        logger.info("==================================================================")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
