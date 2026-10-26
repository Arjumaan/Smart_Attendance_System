"""Biometrics API: Facial Enrollment and Real-Time Recognition."""

import asyncio
import base64
from datetime import datetime, timezone
from typing import Optional
import cv2
from fastapi import APIRouter, Depends, HTTPException, status
import numpy as np
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_db, require_hr_or_admin
from backend.app.api.v1.ws import ws_manager
from backend.app.core.config import settings
from backend.app.core.encryption import encrypt_embedding
from backend.app.core.security import CurrentUser
from backend.app.models.face_embedding import FaceEmbedding
from backend.app.models.user import User
from backend.app.schemas.biometrics import (
    BiometricEnrollRequest,
    BiometricMatchResult,
    BiometricVerifyRequest,
    FaceEmbeddingOut,
)
from backend.app.services.attendance_service import record_attendance_event
from backend.app.services.face_engine import (
    compute_embedding,
    default_cache,
    detect_and_align,
)
from backend.app.services.liveness import verify_liveness

router = APIRouter(prefix="/biometrics", tags=["Biometrics"])


def _decode_base64_image(raw_str: str) -> np.ndarray:
    """Decode base64 string (with or without data URL prefix) into BGR OpenCV image."""
    try:
        if "," in raw_str:
            raw_str = raw_str.split(",", 1)[1]
        img_bytes = base64.b64decode(raw_str)
        img_np = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
        if img is None or img.size == 0:
            raise ValueError("Decoded image is empty.")
        return img
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image format: {e}",
        )


@router.post("/enroll", response_model=FaceEmbeddingOut)
def enroll_face(
    enroll_req: BiometricEnrollRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Enroll facial biometrics for an employee.

    Accepts base64 portrait image or direct 512-d vector.
    Extracts embedding, encrypts at rest (AES-256), and updates in-memory cache.
    """
    user = (
        db.query(User)
        .options(joinedload(User.department), joinedload(User.face_embedding))
        .filter(
            (User.employee_id == enroll_req.employee_id.strip())
            | (
                User.id == int(enroll_req.employee_id)
                if enroll_req.employee_id.isdigit()
                else False
            )
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee '{enroll_req.employee_id}' not found.",
        )

    embedding_vec: Optional[np.ndarray] = None

    if enroll_req.embedding is not None:
        if len(enroll_req.embedding) != 512:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Embedding vector must be 512-dimensional, received {len(enroll_req.embedding)}.",
            )
        vec = np.array(enroll_req.embedding, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 1e-8:
            vec /= norm
        embedding_vec = vec

    elif enroll_req.image_base64:
        img = _decode_base64_image(enroll_req.image_base64)
        crops = detect_and_align(img)
        if not crops:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No face detected in the provided portrait image.",
            )
        embedding_vec = compute_embedding(crops[0].aligned_face)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either image_base64 or embedding vector must be provided.",
        )

    # Encrypt embedding at rest (AES-256-GCM)
    encrypted_token = encrypt_embedding(embedding_vec)

    # Persist to database
    face_emb = user.face_embedding
    if face_emb is not None:
        face_emb.encrypted_embedding = encrypted_token
        face_emb.updated_at = datetime.now(timezone.utc)
    else:
        face_emb = FaceEmbedding(
            user_id=user.id,
            encrypted_embedding=encrypted_token,
            embedding_version="facenet-512-v1",
        )
        db.add(face_emb)

    db.commit()
    db.refresh(face_emb)

    # Update in-memory vector cache
    dept_name = user.department.name if user.department else ""
    default_cache.add_embedding(
        user_id=user.id,
        employee_id=user.employee_id,
        embedding=embedding_vec,
        name=user.full_name,
        department=dept_name,
    )

    return face_emb


@router.post("/recognize", response_model=BiometricMatchResult)
async def recognize_face(
    verify_req: BiometricVerifyRequest,
    db: Session = Depends(get_db),
):
    """Recognize a face from a camera frame or query vector.

    Executes anti-spoofing verification, matches against in-memory embedding cache,
    triggers attendance state machine check-in/out, and broadcasts real-time WebSocket event.
    """
    query_vector: Optional[np.ndarray] = None
    liveness_ok = True
    liveness_msg = "Live capture verified"

    if verify_req.image_base64:
        img = _decode_base64_image(verify_req.image_base64)

        # Anti-spoofing liveness verification
        liveness_ok, _, reason = verify_liveness(img)
        if not liveness_ok:
            return BiometricMatchResult(
                matched=False,
                similarity_score=0.0,
                threshold=settings.SIMILARITY_THRESHOLD,
                liveness_verified=False,
                message=f"Liveness check failed: {reason}",
            )

        crops = detect_and_align(img)
        if not crops:
            return BiometricMatchResult(
                matched=False,
                similarity_score=0.0,
                threshold=settings.SIMILARITY_THRESHOLD,
                liveness_verified=True,
                message="No face detected in camera frame.",
            )
        query_vector = compute_embedding(crops[0].aligned_face)

    elif verify_req.embedding is not None:
        if len(verify_req.embedding) != 512:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Query vector must be 512-dimensional, received {len(verify_req.embedding)}.",
            )
        vec = np.array(verify_req.embedding, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 1e-8:
            vec /= norm
        query_vector = vec
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either image_base64 or embedding vector must be provided.",
        )

    # Match against vectorized in-memory cache
    matched_user_id, matched_emp_id, score = default_cache.find_matching_user(
        query_vector,
        threshold=settings.SIMILARITY_THRESHOLD,
    )

    if not matched_user_id:
        return BiometricMatchResult(
            matched=False,
            similarity_score=round(score, 4),
            threshold=settings.SIMILARITY_THRESHOLD,
            liveness_verified=True,
            message="Face detected but does not match any enrolled employee.",
        )

    # Retrieve matched employee
    user = db.query(User).filter(User.id == matched_user_id).first()
    if not user:
        return BiometricMatchResult(
            matched=False,
            similarity_score=round(score, 4),
            threshold=settings.SIMILARITY_THRESHOLD,
            liveness_verified=True,
            message="Matched employee record could not be found in database.",
        )

    # Record attendance event via state machine
    now = datetime.now()
    att_res = record_attendance_event(
        db=db,
        employee_id=user.employee_id,
        timestamp=now,
        source="KIOSK",
    )

    att_dict = att_res.model_dump(mode="json")

    # Broadcast event to active WebSockets (kiosks and dashboards)
    try:
        asyncio.create_task(ws_manager.broadcast_attendance(att_dict))
    except Exception:
        pass

    return BiometricMatchResult(
        matched=True,
        user_id=user.id,
        employee_id=user.employee_id,
        full_name=user.full_name,
        similarity_score=round(score, 4),
        threshold=settings.SIMILARITY_THRESHOLD,
        liveness_verified=True,
        message=f"Welcome {user.full_name}! {att_res.message}",
        attendance=att_dict,
    )
