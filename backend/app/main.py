"""FastAPI Application Entrypoint and Gateway for Smart Attendance System."""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1 import api_v1_router
from backend.app.api.v1.ws import router as ws_router
from backend.app.core.config import settings
from backend.app.db.base import Base
from backend.app.db.session import SessionLocal, engine
from backend.app.services.face_engine import default_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart_attendance")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database initialization and in-memory cache warmup."""
    # 1. Ensure database schema tables exist
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")
    except Exception as e:
        logger.error(f"Error ensuring database tables: {e}")

    # 2. Warm up in-memory biometric vector cache from database
    db = SessionLocal()
    try:
        count = default_cache.load_from_db(db)
        logger.info(f"Initialized in-memory cache with {count} enrolled employee embeddings.")
    except Exception as e:
        logger.warning(f"Embedding cache warmup encountered notice: {e}")
    finally:
        db.close()

    yield

    # Clean shutdown logic if needed
    logger.info("Shutting down Smart Attendance API server.")


def create_app() -> FastAPI:
    """Factory creating and configuring the FastAPI application."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
    )

    # Configure CORS
    cors_origins = (
        settings.BACKEND_CORS_ORIGINS
        if settings.BACKEND_CORS_ORIGINS
        else ["*"]
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount REST & WebSocket routes
    application.include_router(api_v1_router, prefix=settings.API_V1_STR)
    # Also mount ws_router at root /ws for kiosk convenience
    application.include_router(ws_router)

    @application.get("/health", tags=["Health"])
    def health_check():
        return {
            "status": "healthy",
            "project": settings.PROJECT_NAME,
            "version": "1.0.0",
        }

    return application


app = create_app()
