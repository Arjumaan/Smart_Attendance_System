"""Biometrics and facial embedding Pydantic schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BiometricEnrollRequest(BaseModel):
    employee_id: str = Field(..., description="Unique employee ID to enroll facial biometrics for.")
    image_base64: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG portrait frame.")
    embedding: Optional[List[float]] = Field(None, description="Optional raw 512-d float vector.")


class BiometricVerifyRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64 encoded camera frame to identify.")
    embedding: Optional[List[float]] = Field(None, description="Direct 512-d float query vector.")


class BiometricMatchResult(BaseModel):
    matched: bool
    user_id: Optional[int] = None
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    similarity_score: float = Field(0.0, ge=0.0, le=1.0)
    threshold: float = Field(0.75, ge=0.0, le=1.0)
    liveness_verified: bool = True
    message: Optional[str] = None
    attendance: Optional[dict] = None


class FaceEmbeddingOut(BaseModel):
    id: int
    user_id: int
    embedding_version: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Aliases for interface compliance
FaceEnrollRequest = BiometricEnrollRequest
FaceRecognitionRequest = BiometricVerifyRequest

