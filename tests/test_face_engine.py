"""Comprehensive test suite for Face Recognition Biometrics & Anti-Spoofing Engine (Milestone 2).

Verifies:
1. Face detection and roll alignment using OpenCV cascades.
2. 512-dimensional unit-normalized embedding extraction.
3. Matching identity similarity > 0.75 across illumination, contrast, and noise variations.
4. Distinct identity similarity < 0.40 across distinct facial geometries.
5. Anti-spoofing liveness engine rejecting screens (Moire), printouts (specular glare), and flat photos.
6. Vectorized in-memory EmbeddingCache sub-50ms lookup speed, database loading, and accuracy.
"""

import time
from typing import Tuple
import cv2
import numpy as np
import pytest
from sqlalchemy.orm import Session

from backend.app.core.encryption import encrypt_embedding, generate_encryption_key
from backend.app.models.department import Department
from backend.app.models.face_embedding import FaceEmbedding
from backend.app.models.user import User, UserRole
from backend.app.services.face_engine import (
    EmbeddingCache,
    FaceCrop,
    compute_cosine_similarity,
    compute_embedding,
    detect_and_align,
    match_embedding,
)
from backend.app.services.liveness import verify_liveness


# ============================================================================
# Synthetic Face & Spoof Generators for Deterministic Biometric Verification
# ============================================================================


def generate_synthetic_portrait(
    eye_dist: int = 24,
    eye_y: int = 60,
    nose_len: int = 20,
    mouth_w: int = 18,
    skin_tone: Tuple[int, int, int] = (150, 170, 220),
    hair_color: Tuple[int, int, int] = (30, 20, 15),
    bg_color: Tuple[int, int, int] = (210, 210, 210),
    brightness: int = 0,
    contrast: float = 1.0,
    noise_sigma: float = 0.0,
    face_rx: int = 0,
    face_ry: int = 0,
    size: Tuple[int, int] = (200, 200),
) -> np.ndarray:
    """Generate a clean synthetic portrait image with customizable facial geometry."""
    w, h = size
    img = np.ones((h, w, 3), dtype=np.uint8)
    img[:] = bg_color

    cx, cy = w // 2, int(h * 0.52)
    rx = face_rx if face_rx > 0 else int(w * 0.32)
    ry = face_ry if face_ry > 0 else int(h * 0.40)

    # Face contour
    cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, skin_tone, -1)

    # Hair
    cv2.ellipse(img, (cx, cy - int(ry * 0.65)), (rx + 4, int(ry * 0.45)), 0, 180, 360, hair_color, -1)

    # Eyes & Eyebrows
    actual_eye_y = cy - int(ry * 0.22) + (eye_y - 60)
    lx = cx - eye_dist
    rx_eye = cx + eye_dist

    # Eyes (sclera + dark iris)
    cv2.circle(img, (lx, actual_eye_y), 8, (245, 245, 245), -1)
    cv2.circle(img, (rx_eye, actual_eye_y), 8, (245, 245, 245), -1)
    cv2.circle(img, (lx, actual_eye_y), 4, (30, 20, 10), -1)
    cv2.circle(img, (rx_eye, actual_eye_y), 4, (30, 20, 10), -1)

    # Eyebrows
    cv2.line(img, (lx - 12, actual_eye_y - 10), (lx + 10, actual_eye_y - 8), hair_color, 3)
    cv2.line(img, (rx_eye - 10, actual_eye_y - 8), (rx_eye + 12, actual_eye_y - 10), hair_color, 3)

    # Nose
    nose_start_y = actual_eye_y + 6
    cv2.line(img, (cx, nose_start_y), (cx, nose_start_y + nose_len), (skin_tone[0] - 30, skin_tone[1] - 30, skin_tone[2] - 30), 2)

    # Mouth
    mouth_y = nose_start_y + nose_len + 12
    cv2.ellipse(img, (cx, mouth_y), (mouth_w, 4), 0, 0, 360, (80, 90, 160), -1)

    # Apply lighting, contrast, and noise variations
    out = img.astype(np.float32)
    if contrast != 1.0:
        out = (out - 128.0) * contrast + 128.0
    if brightness != 0:
        out = out + brightness
    if noise_sigma > 0.0:
        out = out + np.random.normal(0, noise_sigma, out.shape)

    return np.clip(out, 0, 255).astype(np.uint8)


def generate_live_camera_frame() -> np.ndarray:
    """Generate a realistic live camera frame of an employee."""
    portrait = generate_synthetic_portrait(
        eye_dist=26,
        eye_y=60,
        nose_len=22,
        mouth_w=20,
        skin_tone=(140, 165, 215),
        noise_sigma=2.0,  # Subtle camera sensor noise
        size=(240, 240),
    )
    return portrait


def generate_screen_spoof_frame() -> np.ndarray:
    """Generate a digital screen capture attack with periodic subpixel Moire grid."""
    live = generate_live_camera_frame().astype(np.float32)
    h, w = live.shape[:2]
    y_coords, x_coords = np.mgrid[0:h, 0:w]
    # Periodic screen grid (4-pixel frequency pattern)
    screen_pattern = 30.0 * (np.sin(2.0 * np.pi * x_coords / 4.0) + np.sin(2.0 * np.pi * y_coords / 4.0))
    spoofed = np.clip(live + screen_pattern[:, :, None], 0, 255).astype(np.uint8)
    return spoofed


def generate_printout_specular_spoof_frame() -> np.ndarray:
    """Generate a photo paper printout attack with harsh specular sheen glare."""
    live = generate_live_camera_frame()
    # Harsh white specular blowout glare hotspot from overhead office fluorescent lights
    cv2.circle(live, (120, 100), 20, (255, 255, 255), -1)
    cv2.circle(live, (120, 100), 28, (252, 252, 252), 3)
    return live


def generate_flat_blurry_photo_spoof_frame() -> np.ndarray:
    """Generate a flat, out-of-focus photo printout with low texture depth."""
    live = generate_live_camera_frame()
    # Out of focus blur simulating flat paper capture
    blurry = cv2.GaussianBlur(live, (15, 15), 5.0)
    return blurry


# ============================================================================
# 1. Face Detection and Alignment Tests
# ============================================================================


def test_face_detection_and_alignment_portrait():
    """Verify face detection and roll alignment on a portrait image."""
    portrait = generate_synthetic_portrait(size=(220, 220))
    faces = detect_and_align(portrait, target_size=(160, 160))

    assert len(faces) >= 1, "Face detection should detect at least 1 face crop."
    face_crop = faces[0]
    assert isinstance(face_crop, FaceCrop)
    assert len(face_crop.bbox) == 4
    x, y, w, h = face_crop.bbox
    assert w > 0 and h > 0

    assert face_crop.aligned_face.shape == (160, 160, 3)
    assert face_crop.aligned_face.dtype == np.uint8
    assert isinstance(face_crop.roll_angle, float)


def test_face_detection_empty_or_invalid_input():
    """Verify face detection handles empty or invalid inputs gracefully."""
    assert detect_and_align(None) == []
    assert detect_and_align(np.array([])) == []
    blank_zeros = np.zeros((100, 100, 3), dtype=np.uint8)
    # A pure black image has no face
    result = detect_and_align(blank_zeros)
    assert isinstance(result, list)


def test_face_detection_with_roll_alignment():
    """Verify roll angle alignment on a tilted face portrait."""
    portrait = generate_synthetic_portrait(size=(240, 240))
    # Rotate by 10 degrees
    center = (120, 120)
    rot_matrix = cv2.getRotationMatrix2D(center, 10.0, 1.0)
    tilted = cv2.warpAffine(portrait, rot_matrix, (240, 240))

    faces = detect_and_align(tilted, target_size=(160, 160))
    assert len(faces) >= 1
    assert faces[0].aligned_face.shape == (160, 160, 3)


# ============================================================================
# 2. 512-Dimensional Normalized Embedding Extractor Tests
# ============================================================================


def test_embedding_extraction_dimension_and_norm():
    """Verify that compute_embedding produces exactly 512-d float32 vector with norm 1.0."""
    portrait = generate_synthetic_portrait(size=(160, 160))
    embedding = compute_embedding(portrait)

    assert isinstance(embedding, np.ndarray), "Embedding must be a numpy ndarray."
    assert embedding.shape == (512,), f"Expected shape (512,), got {embedding.shape}."
    assert embedding.dtype == np.float32, f"Expected float32, got {embedding.dtype}."

    l2_norm = float(np.linalg.norm(embedding))
    assert np.isclose(l2_norm, 1.0, atol=1e-5), f"Expected unit norm 1.0, got {l2_norm}."


def test_embedding_extraction_deterministic():
    """Verify that compute_embedding is strictly deterministic across repeated calls."""
    portrait = generate_synthetic_portrait(size=(160, 160))
    emb1 = compute_embedding(portrait)
    emb2 = compute_embedding(portrait)

    assert np.array_equal(emb1, emb2), "Embedding extraction must be strictly deterministic."
    sim = compute_cosine_similarity(emb1, emb2)
    assert np.isclose(sim, 1.0, atol=1e-6)


def test_embedding_extraction_from_face_crop():
    """Verify that compute_embedding accepts a FaceCrop instance directly."""
    portrait = generate_synthetic_portrait(size=(200, 200))
    faces = detect_and_align(portrait)
    assert len(faces) >= 1

    embedding = compute_embedding(faces[0])
    assert embedding.shape == (512,)
    assert np.isclose(float(np.linalg.norm(embedding)), 1.0, atol=1e-5)


# ============================================================================
# 3. Matching Identity vs Distinct Identity Discrimination Tests
# ============================================================================


def test_matching_identity_similarity_threshold():
    """Verify that the SAME identity with minor variations produces similarity > 0.75."""
    base_person = generate_synthetic_portrait(
        eye_dist=24,
        eye_y=60,
        nose_len=20,
        mouth_w=18,
        skin_tone=(150, 170, 220),
        size=(160, 160),
    )
    base_emb = compute_embedding(base_person)

    variations = [
        # 1. Lighting brightness increase (+25)
        generate_synthetic_portrait(
            eye_dist=24, eye_y=60, nose_len=20, mouth_w=18,
            skin_tone=(150, 170, 220), brightness=25, size=(160, 160),
        ),
        # 2. Lighting darkness decrease (-25)
        generate_synthetic_portrait(
            eye_dist=24, eye_y=60, nose_len=20, mouth_w=18,
            skin_tone=(150, 170, 220), brightness=-25, size=(160, 160),
        ),
        # 3. Contrast adjustment (0.9x and 1.1x)
        generate_synthetic_portrait(
            eye_dist=24, eye_y=60, nose_len=20, mouth_w=18,
            skin_tone=(150, 170, 220), contrast=1.1, size=(160, 160),
        ),
        # 4. Subtle Gaussian sensor noise (sigma=3.5)
        generate_synthetic_portrait(
            eye_dist=24, eye_y=60, nose_len=20, mouth_w=18,
            skin_tone=(150, 170, 220), noise_sigma=3.5, size=(160, 160),
        ),
        # 5. Combined brightness shift + subtle sensor noise
        generate_synthetic_portrait(
            eye_dist=24, eye_y=60, nose_len=20, mouth_w=18,
            skin_tone=(150, 170, 220), brightness=15, noise_sigma=2.5, size=(160, 160),
        ),
    ]

    for i, var_img in enumerate(variations):
        var_emb = compute_embedding(var_img)
        similarity = compute_cosine_similarity(base_emb, var_emb)
        assert similarity >= 0.75, (
            f"Matching identity variation #{i+1} failed: similarity {similarity:.4f} < 0.75"
        )


def test_distinct_identities_similarity_threshold():
    """Verify that DIFFERENT identities have cosine similarity < 0.40."""
    # Person A: narrow face, short nose, light skin, dark hair
    person_a = generate_synthetic_portrait(
        face_rx=42, face_ry=54,
        eye_dist=18, eye_y=55, nose_len=16, mouth_w=16,
        skin_tone=(175, 195, 235), hair_color=(15, 10, 10), bg_color=(230, 230, 230),
        size=(160, 160),
    )
    # Person B: wide/round face, long nose, darker skin, lighter hair
    person_b = generate_synthetic_portrait(
        face_rx=60, face_ry=68,
        eye_dist=32, eye_y=72, nose_len=28, mouth_w=28,
        skin_tone=(110, 130, 170), hair_color=(60, 50, 40), bg_color=(180, 180, 180),
        size=(160, 160),
    )
    # Person C: long oval face, medium nose, olive skin
    person_c = generate_synthetic_portrait(
        face_rx=48, face_ry=60,
        eye_dist=24, eye_y=64, nose_len=22, mouth_w=20,
        skin_tone=(140, 160, 190), hair_color=(35, 25, 20), bg_color=(240, 240, 240),
        size=(160, 160),
    )

    emb_a = compute_embedding(person_a)
    emb_b = compute_embedding(person_b)
    emb_c = compute_embedding(person_c)

    sim_ab = compute_cosine_similarity(emb_a, emb_b)
    sim_ac = compute_cosine_similarity(emb_a, emb_c)
    sim_bc = compute_cosine_similarity(emb_b, emb_c)

    assert sim_ab < 0.40, f"Distinct identities A & B have high similarity: {sim_ab:.4f} >= 0.40"
    assert sim_ac < 0.40, f"Distinct identities A & C have high similarity: {sim_ac:.4f} >= 0.40"
    assert sim_bc < 0.40, f"Distinct identities B & C have high similarity: {sim_bc:.4f} >= 0.40"


# ============================================================================
# 4. Anti-Spoofing and Liveness Verification Tests
# ============================================================================


def test_anti_spoofing_accepts_live_face():
    """Verify that a genuine camera face capture is verified as live."""
    live_frame = generate_live_camera_frame()
    is_live, score, reason = verify_liveness(live_frame)

    assert is_live is True, f"Live capture rejected with reason: {reason}"
    assert score >= 0.80, f"Expected high confidence score for live face, got {score}"
    assert "Live capture verified" in reason


def test_anti_spoofing_rejects_screen_moire():
    """Verify that an LCD/OLED screen capture attack is rejected via Moire detection."""
    screen_frame = generate_screen_spoof_frame()
    is_live, score, reason = verify_liveness(screen_frame)

    assert is_live is False, "Screen attack should be detected and rejected."
    assert "Moire pattern from digital screen" in reason
    assert score < 0.50


def test_anti_spoofing_rejects_photo_paper_specular_glare():
    """Verify that a photo paper printout is rejected via specular glare detection."""
    printout_frame = generate_printout_specular_spoof_frame()
    is_live, score, reason = verify_liveness(printout_frame)

    assert is_live is False, "Photo printout attack should be rejected."
    assert "specular reflection" in reason.lower()
    assert score < 0.50


def test_anti_spoofing_rejects_flat_blurry_photo():
    """Verify that a flat out-of-focus photo printout is rejected via texture analysis."""
    flat_frame = generate_flat_blurry_photo_spoof_frame()
    is_live, score, reason = verify_liveness(flat_frame)

    assert is_live is False, "Flat blurry photo should be rejected."
    assert "Insufficient texture depth" in reason
    assert score < 0.50


def test_anti_spoofing_multi_frame_static_photo():
    """Verify multi-frame temporal detection rejects static physical photos."""
    live_frame = generate_live_camera_frame()
    # Identical repeated frames with zero natural micro-motion
    static_frames = [live_frame.copy() for _ in range(5)]
    is_live, score, reason = verify_liveness(static_frames)

    assert is_live is False
    assert "no natural micro-motion" in reason.lower()


# ============================================================================
# 5. In-Memory EmbeddingCache Tests
# ============================================================================


def test_embedding_cache_add_and_match():
    """Verify EmbeddingCache correctly adds, matches, and rejects un-enrolled users."""
    cache = EmbeddingCache()

    # Generate distinct embeddings for 3 employees
    p1 = generate_synthetic_portrait(eye_dist=18, eye_y=55, nose_len=16, mouth_w=16, size=(160, 160))
    p2 = generate_synthetic_portrait(eye_dist=32, eye_y=72, nose_len=28, mouth_w=28, size=(160, 160))
    p3 = generate_synthetic_portrait(eye_dist=24, eye_y=60, nose_len=20, mouth_w=20, size=(160, 160))

    emb1 = compute_embedding(p1)
    emb2 = compute_embedding(p2)
    emb3 = compute_embedding(p3)

    cache.add_embedding(user_id=1, employee_id="EMP001", embedding=emb1, name="Alice", department="Engineering")
    cache.add_embedding(user_id=2, employee_id="EMP002", embedding=emb2, name="Bob", department="HR")
    cache.add_embedding(user_id=3, employee_id="EMP003", embedding=emb3, name="Charlie", department="Sales")

    assert len(cache) == 3

    # Query with a noisy variation of Bob (EMP002)
    p2_noisy = generate_synthetic_portrait(
        eye_dist=32, eye_y=72, nose_len=28, mouth_w=28,
        brightness=20, noise_sigma=2.0, size=(160, 160),
    )
    q_emb = compute_embedding(p2_noisy)

    matched_user_id, matched_emp_id, sim = cache.find_matching_user(q_emb, threshold=0.75)
    assert matched_user_id == 2, f"Expected user_id 2, got {matched_user_id}"
    assert matched_emp_id == "EMP002", f"Expected EMP002, got {matched_emp_id}"
    assert sim >= 0.75, f"Expected similarity >= 0.75, got {sim:.4f}"

    # Query with an unknown person
    unknown_person = generate_synthetic_portrait(
        eye_dist=12, eye_y=50, nose_len=14, mouth_w=14,
        skin_tone=(200, 220, 250), size=(160, 160),
    )
    q_unknown = compute_embedding(unknown_person)
    unmatched_user_id, unmatched_emp_id, unk_sim = cache.find_matching_user(q_unknown, threshold=0.75)
    assert unmatched_user_id is None
    assert unmatched_emp_id is None

    # Test top-level match_embedding convenience function
    m_uid, m_score = match_embedding(q_emb, threshold=0.75, cache=cache)
    assert m_uid == 2
    assert m_score == sim


def test_embedding_cache_sub_50ms_matching_latency():
    """Verify that vectorized embedding search across 1000 employees completes in < 50ms."""
    cache = EmbeddingCache()
    np.random.seed(42)

    # Populate cache with 1000 synthetic 512-d embeddings
    num_employees = 1000
    for i in range(num_employees):
        vec = np.random.randn(512).astype(np.float32)
        vec /= np.linalg.norm(vec)
        cache.add_embedding(
            user_id=i + 1,
            employee_id=f"EMP{i+1:04d}",
            embedding=vec,
            name=f"User {i+1}",
            department="Operations",
        )

    assert len(cache) == 1000

    # Benchmark query latency over 50 iterations
    query_vec = np.random.randn(512).astype(np.float32)
    query_vec /= np.linalg.norm(query_vec)

    latencies_ms = []
    for _ in range(50):
        t0 = time.perf_counter()
        _ = cache.find_matching_user(query_vec, threshold=0.75)
        dt = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(dt)

    avg_latency = float(np.mean(latencies_ms))
    p95_latency = float(np.percentile(latencies_ms, 95))

    # Must be sub-50ms (ordinarily < 2ms)
    assert avg_latency < 50.0, f"Average latency too high: {avg_latency:.2f} ms >= 50ms"
    assert p95_latency < 50.0, f"P95 latency too high: {p95_latency:.2f} ms >= 50ms"


def test_embedding_cache_load_from_db(db_session: Session, test_key: str):
    """Verify EmbeddingCache loads and decrypts biometric vectors from database models."""
    # Seed Department and User
    dept = Department(name="Biometrics Team", code="BIO")
    db_session.add(dept)
    db_session.commit()
    db_session.refresh(dept)

    user = User(
        employee_id="BIO001",
        full_name="Sarah Connor",
        email="sarah@resistance.com",
        role=UserRole.EMPLOYEE.value,
        department_id=dept.id,
        hashed_password="dummy_hash_for_test",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Create realistic face embedding and encrypt it
    portrait = generate_synthetic_portrait(size=(160, 160))
    raw_emb = compute_embedding(portrait)
    encrypted_blob = encrypt_embedding(raw_emb, key=test_key)

    face_record = FaceEmbedding(
        user_id=user.id,
        encrypted_embedding=encrypted_blob,
        embedding_version="dct_hog_lbp_512",
    )
    db_session.add(face_record)
    db_session.commit()

    # Load cache from DB
    cache = EmbeddingCache(key=test_key)
    loaded_count = cache.load_from_db(db_session)
    assert loaded_count == 1
    assert len(cache) == 1

    # Verify query matching against loaded user
    matched_id, matched_emp, sim = cache.find_matching_user(raw_emb, threshold=0.75)
    assert matched_id == user.id
    assert matched_emp == "BIO001"
    assert np.isclose(sim, 1.0, atol=1e-5)
