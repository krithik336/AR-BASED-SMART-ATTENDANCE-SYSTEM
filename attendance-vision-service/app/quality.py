"""Face quality assessment for camera guidance and capture filtering.

Produces a ``FaceQuality`` verdict (GOOD / WARNING / POOR) per detected face
from lightweight image heuristics:

- size       minimum face dimension and relative size in the image
- blur       variance of the Laplacian on the face crop
- brightness mean luminance of the face crop
- pose       approximate yaw / pitch from landmark geometry
- occlusion  landmark validity and containment in the bounding box

The verdicts are advisory and the thresholds are configurable so they can be
calibrated on the real classroom dataset (see ``.env.example``).
"""
from dataclasses import dataclass
from math import asin, degrees
from typing import List, Optional

import cv2
import numpy as np

from .config import Settings


@dataclass
class FaceQuality:
    """Result of assessing one detected face."""

    score: float
    size_ok: bool
    blur_ok: bool
    brightness_ok: bool
    pose_ok: bool
    occlusion_ok: bool
    reasons: List[str]
    verdict: str  # "GOOD" | "WARNING" | "POOR"

    def to_schema(self):
        from .schemas import FaceQuality as FaceQualitySchema

        return FaceQualitySchema(
            score=round(float(self.score), 4),
            size_ok=self.size_ok,
            blur_ok=self.blur_ok,
            brightness_ok=self.brightness_ok,
            pose_ok=self.pose_ok,
            occlusion_ok=self.occlusion_ok,
            reasons=self.reasons,
            verdict=self.verdict,
        )


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _approx_pose(
    landmarks: Optional[List[List[float]]], x1: float, y1: float, x2: float, y2: float
) -> tuple[float, float]:
    """Approximate yaw / pitch (degrees) from the 5 facial landmarks.

    The landmark ordering is treated as unknown, so the two uppermost points are
    taken as the eyes and the point closest to the vertical eye-line middle as
    the nose. Sign is irrelevant here (only magnitude is used).
    """
    if landmarks is None or len(landmarks) < 5:
        return 0.0, 0.0

    pts = np.asarray(landmarks, dtype=np.float64)  # (N, 2)
    width = max(1e-6, x2 - x1)
    height = max(1e-6, y2 - y1)

    top_two = pts[np.argsort(pts[:, 1])[:2]]
    eye_mid = top_two.mean(axis=0)
    face_cx = (x1 + x2) / 2.0
    dx_norm = _clip((eye_mid[0] - face_cx) / (width / 2.0), -1.0, 1.0)
    yaw = degrees(asin(dx_norm))

    rest = pts[np.delete(np.arange(len(pts)), np.argsort(pts[:, 1])[:2])]
    nose = rest[np.argmin(np.abs(rest[:, 1] - eye_mid[1]))]
    dy_norm = _clip((nose[1] - eye_mid[1]) / (height / 2.0), -1.0, 1.0)
    pitch = degrees(asin(dy_norm))

    return float(yaw), float(pitch)


def assess_face(
    image_bgr: np.ndarray,
    bbox: List[float],
    landmarks: Optional[List[List[float]]],
    detection_confidence: float,
    settings: Settings,
) -> FaceQuality:
    """Assess a single detected face (bbox in image pixel coordinates)."""
    x1, y1, x2, y2 = [float(v) for v in bbox]
    img_h, img_w = image_bgr.shape[:2]
    width = max(0.0, x2 - x1)
    height = max(0.0, y2 - y1)
    min_dim = min(width, height)

    reasons: List[str] = []

    # ── Size ────────────────────────────────────────────────────────────────
    size_ok = min_dim >= settings.min_face_size and height >= settings.min_face_ratio * img_h
    if not size_ok:
        reasons.append("face too small")

    # ── Crop (used for blur / brightness) ───────────────────────────────────
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    side = int(max(width, height, 1.0) * 1.5)
    half = side // 2
    x0, y0 = max(0, int(cx - half)), max(0, int(cy - half))
    x1c, y1c = min(img_w, x0 + side), min(img_h, y0 + side)
    crop = image_bgr[y0:y1c, x0:x1c]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if crop.size else np.zeros((1, 1), dtype=np.uint8)

    blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var()) if gray.size >= 9 else 0.0
    blur_ok = blur_var >= settings.blur_variance_threshold
    if not blur_ok:
        reasons.append(f"blurry (variance={blur_var:.0f})")

    brightness = float(gray.mean()) if gray.size else 0.0
    brightness_ok = settings.brightness_min <= brightness <= settings.brightness_max
    extreme_brightness = brightness < 20.0 or brightness > 250.0
    if not brightness_ok:
        reasons.append(f"poor brightness (mean={brightness:.0f})")

    # ── Pose ────────────────────────────────────────────────────────────────
    yaw, pitch = _approx_pose(landmarks, x1, y1, x2, y2)
    pose_ok = abs(yaw) <= settings.pose_yaw_max and abs(pitch) <= settings.pose_pitch_max
    if not pose_ok:
        reasons.append(f"large pose (yaw={yaw:.0f}, pitch={pitch:.0f})")

    # ── Occlusion ───────────────────────────────────────────────────────────
    occlusion_ok = landmarks is not None and len(landmarks) >= 5
    if occlusion_ok:
        pad_x = width * 0.25
        pad_y = height * 0.25
        for px, py in landmarks:
            if px < x1 - pad_x or px > x2 + pad_x or py < y1 - pad_y or py > y2 + pad_y:
                occlusion_ok = False
                break
    if not occlusion_ok:
        reasons.append("occlusion or missing landmarks")

    # ── Score & verdict ─────────────────────────────────────────────────────
    blur_score = _clip(blur_var / settings.blur_variance_threshold, 0.0, 1.0)
    brightness_score = 1.0 - _clip(abs(brightness - (settings.brightness_min + settings.brightness_max) / 2.0)
                                   / 120.0, 0.0, 1.0)
    score = (
        0.30 * (1.0 if size_ok else 0.0)
        + 0.25 * blur_score
        + 0.15 * brightness_score
        + 0.20 * (1.0 if pose_ok else 0.2)
        + 0.10 * (1.0 if occlusion_ok else 0.0)
    )

    if not size_ok or not occlusion_ok or not blur_ok or extreme_brightness:
        verdict = "POOR"
    elif not brightness_ok or not pose_ok or score < 0.70 or detection_confidence < 0.60:
        verdict = "WARNING"
    else:
        verdict = "GOOD"

    return FaceQuality(
        score=round(score, 4),
        size_ok=size_ok,
        blur_ok=blur_ok,
        brightness_ok=brightness_ok,
        pose_ok=pose_ok,
        occlusion_ok=occlusion_ok,
        reasons=reasons,
        verdict=verdict,
    )
