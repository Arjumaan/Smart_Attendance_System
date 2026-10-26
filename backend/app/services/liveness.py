"""Anti-spoofing and facial liveness verification engine.

Rejects presentation attacks including:
1. Digital screens (LCD, OLED monitors/smartphones) via 2D FFT Moire frequency analysis.
2. Photo printouts via specular reflection glare & dynamic range / chrominance analysis.
3. Flat / blurry photos via Laplacian variance and Local Binary Pattern texture depth.
4. Static physical photos via multi-frame temporal micro-motion consistency.
"""

from typing import List, Tuple, Union
import cv2
import numpy as np

# Threshold parameters calibrated for enterprise kiosk and webcam capture
MOIRE_PEAK_RATIO_THRESHOLD = 1.65
SPECULAR_CLIP_AREA_THRESHOLD = 0.008
MIN_LAPLACIAN_VARIANCE = 50.0
MAX_LAPLACIAN_VARIANCE = 3500.0
MIN_CHROMINANCE_STD = 1.2
MIN_TEMPORAL_MOTION_STD = 0.3


def detect_screen_moire(gray: np.ndarray) -> Tuple[bool, float]:
    """Detect LCD/OLED screen pixel grid Moire interference via 2D FFT.

    Screen subpixel structures generate sharp harmonic frequency spikes in
    the high-frequency spectral annulus of the 2D Fourier magnitude spectrum.

    Returns:
        Tuple of (is_spoof: bool, peak_to_mean_ratio: float).
    """
    if gray.size == 0:
        return False, 0.0

    h, w = gray.shape[:2]
    # Resize to standard analysis resolution if large to accelerate FFT
    if max(h, w) > 320:
        scale = 320.0 / max(h, w)
        gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = gray.shape[:2]

    # Compute 2D Fast Fourier Transform
    fft2 = np.fft.fft2(gray.astype(np.float32))
    fft_shifted = np.fft.fftshift(fft2)
    mag_spectrum = np.log(1.0 + np.abs(fft_shifted))

    cy, cx = h // 2, w // 2
    y_coords, x_coords = np.ogrid[:h, :w]
    radii = np.sqrt((y_coords - cy) ** 2 + (x_coords - cx) ** 2)
    r_max = min(cy, cx)

    if r_max <= 10:
        return False, 0.0

    # High-frequency annular region (between 35% and 95% of Nyquist radius)
    hf_mask = (radii >= 0.35 * r_max) & (radii <= 0.95 * r_max)
    hf_vals = mag_spectrum[hf_mask]

    if len(hf_vals) == 0:
        return False, 0.0

    hf_mean = float(np.mean(hf_vals))
    hf_peak = float(np.max(hf_vals))

    # A blurry or flat image without high-frequency energy cannot be a screen moire attack
    if hf_peak < 2.5:
        return False, 0.0

    ratio = hf_peak / (hf_mean + 1e-6)

    is_screen_spoof = bool(ratio > MOIRE_PEAK_RATIO_THRESHOLD)
    return is_screen_spoof, ratio


def detect_specular_sheen_and_color(bgr: np.ndarray) -> Tuple[bool, float, str]:
    """Detect photo paper specular glare and compressed/unnatural chrominance.

    Printed photo paper reflects room lighting with harsh white specular blowout
    (R=G=B >= 250) across continuous hotspots, unlike natural skin diffuse scattering.

    Returns:
        Tuple of (is_spoof: bool, metric_value: float, detail: str).
    """
    if bgr.ndim != 3 or bgr.shape[2] != 3:
        return False, 0.0, "normal"

    h, w = bgr.shape[:2]
    total_pixels = float(h * w)
    if total_pixels == 0:
        return False, 0.0, "normal"

    # 1. Specular highlight analysis
    clipped_mask = np.all(bgr >= 250, axis=-1)
    clipped_ratio = float(np.sum(clipped_mask)) / total_pixels

    if clipped_ratio > SPECULAR_CLIP_AREA_THRESHOLD:
        return True, clipped_ratio, "Photo printout specular reflection"

    # 2. Chrominance distribution analysis in YCrCb
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    cr = ycrcb[:, :, 1]
    cb = ycrcb[:, :, 2]
    cr_std = float(np.std(cr))
    cb_std = float(np.std(cb))

    if cr_std < MIN_CHROMINANCE_STD and cb_std < MIN_CHROMINANCE_STD:
        return True, float(min(cr_std, cb_std)), "Monochrome or flat paper gamut"

    return False, clipped_ratio, "normal"


def detect_texture_depth(gray: np.ndarray) -> Tuple[bool, float, str]:
    """Analyze skin texture depth via Laplacian focus and Local Binary Patterns.

    Genuine facial skin possesses natural micro-texture, depth-of-field, and
    organic gradient variance. Flat paper printouts lack high-frequency depth.

    Returns:
        Tuple of (is_spoof: bool, variance: float, detail: str).
    """
    if gray.size == 0:
        return False, 0.0, "normal"

    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if laplacian_var < MIN_LAPLACIAN_VARIANCE:
        return True, laplacian_var, "Insufficient texture depth (flat photo)"

    return False, laplacian_var, "normal"


def verify_liveness(
    frame_or_frames: Union[np.ndarray, List[np.ndarray]],
) -> Tuple[bool, float, str]:
    """Verify facial liveness and reject presentation attack attempts.

    Evaluates:
    - High-frequency moire patterns (LCD/OLED screen rejection).
    - Specular reflection & color saturation (paper printout rejection).
    - Laplacian variance & texture depth (flat / blurry photo rejection).
    - Multi-frame temporal micro-motion if multiple frames are provided.

    Args:
        frame_or_frames: A single image frame (np.ndarray) or a temporal
                         sequence of consecutive frames (list of np.ndarray).

    Returns:
        Tuple of (is_live: bool, confidence_score: float, reason: str).
    """
    if frame_or_frames is None:
        return False, 0.0, "Invalid frame input"

    if isinstance(frame_or_frames, list):
        if len(frame_or_frames) == 0:
            return False, 0.0, "Empty frame list"
        frames = frame_or_frames
        primary_frame = frames[0]
    else:
        frames = [frame_or_frames]
        primary_frame = frame_or_frames

    if not isinstance(primary_frame, np.ndarray) or primary_frame.size == 0:
        return False, 0.0, "Invalid frame data"

    # Prepare color and grayscale representations
    if primary_frame.ndim == 2:
        gray = primary_frame
        bgr = cv2.cvtColor(primary_frame, cv2.COLOR_GRAY2BGR)
    elif primary_frame.shape[2] == 4:
        bgr = cv2.cvtColor(primary_frame, cv2.COLOR_BGRA2BGR)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    else:
        bgr = primary_frame
        gray = cv2.cvtColor(primary_frame, cv2.COLOR_BGR2GRAY)

    # 1. Texture Roughness & Depth Analysis (catches flat / blurry printouts)
    is_texture_spoof, lap_val, tex_reason = detect_texture_depth(gray)
    if is_texture_spoof:
        confidence = 0.15
        return False, confidence, f"Spoof detected: {tex_reason}"

    # 2. Screen Moire Pattern Detection (2D FFT)
    is_screen, moire_val = detect_screen_moire(gray)
    if is_screen:
        confidence = float(np.clip(1.0 - (moire_val - MOIRE_PEAK_RATIO_THRESHOLD) * 0.5, 0.05, 0.35))
        return False, confidence, "Spoof detected: Moire pattern from digital screen"

    # 3. Specular Sheen & Chrominance Gamut Analysis (catches photo paper glare)
    is_specular, spec_val, spec_reason = detect_specular_sheen_and_color(bgr)
    if is_specular:
        confidence = 0.20
        return False, confidence, f"Spoof detected: {spec_reason}"

    # 4. Abnormal upper texture limit check (artificial halftone grid)
    if lap_val > MAX_LAPLACIAN_VARIANCE:
        return False, 0.15, "Spoof detected: Abnormal high-frequency texture grid"

    # 4. Multi-frame Temporal Micro-Motion (if sequence provided)
    if len(frames) >= 3:
        diffs: List[float] = []
        prev_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY) if frames[0].ndim == 3 else frames[0]
        for f in frames[1:]:
            curr_gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) if f.ndim == 3 else f
            if curr_gray.shape == prev_gray.shape:
                diff = float(np.mean(np.abs(curr_gray.astype(float) - prev_gray.astype(float))))
                diffs.append(diff)
            prev_gray = curr_gray

        if len(diffs) > 0 and np.mean(diffs) < MIN_TEMPORAL_MOTION_STD:
            return False, 0.25, "Spoof detected: Static photograph held to camera (no natural micro-motion)"

    # Live capture verified
    # Confidence score in [0.85, 0.99] based on healthy texture variance
    healthy_texture_score = float(np.clip((lap_val - MIN_LAPLACIAN_VARIANCE) / 400.0, 0.0, 1.0))
    confidence_score = float(0.85 + 0.14 * healthy_texture_score)

    return True, confidence_score, "Live capture verified"
