"""API v1 Router aggregation."""

from fastapi import APIRouter

from backend.app.api.v1.attendance import router as attendance_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.biometrics import router as biometrics_router
from backend.app.api.v1.departments import router as departments_router
from backend.app.api.v1.employees import router as employees_router
from backend.app.api.v1.reports import router as reports_router
from backend.app.api.v1.ws import router as ws_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(departments_router)
api_v1_router.include_router(employees_router)
api_v1_router.include_router(biometrics_router)
api_v1_router.include_router(attendance_router)
api_v1_router.include_router(reports_router)
api_v1_router.include_router(ws_router)

__all__ = ["api_v1_router"]
