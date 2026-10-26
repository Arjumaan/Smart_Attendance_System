"""Application configuration module using Pydantic Settings."""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Enterprise Smart Attendance System"
    API_V1_STR: str = "/api/v1"

    # Security & JWT Token signing
    SECRET_KEY: str = "default-dev-secret-key-replace-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # AES-256 Key for Biometric Vector Encryption at Rest (32 bytes base64 or raw string)
    BIOMETRIC_ENCRYPTION_KEY: str = "k8Gj9b0+y3DqV2z7sW8m4X5p1R9n6T0vA3c5E7g8J1k="

    # Database Settings
    DATABASE_URL: str = "sqlite:///./attendance.db"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "smart_attendance"
    POSTGRES_PORT: int = 5432

    # Attendance State Machine & Policy Defaults
    SHIFT_START_TIME: str = "09:15"
    COOLDOWN_MINUTES: int = 5
    SIMILARITY_THRESHOLD: float = 0.75

    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
