"""Single-pass face analysis: detect + quality + (optional) embedding.

Runs ``engine.app.get()`` exactly once per image so the same detection results
feed both quality assessment and ArcFace embedding. Used by ``/detect``
(guidance, no embeddings) and by ``/match`` and the embedding endpoints.
"""
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .config import Settings
from .quality import FaceQuality, assess_face
from .schemas import BoundingBox


@dataclass
class AnalyzedFace:
    """One detected face with its quality and optional ArcFace embedding."""

    bbox: BoundingBox
    confidence: float
    quality: FaceQuality
    embedding: Optional[np.ndarray] = None


def analyze_faces(
    engine,
    image_bgr: np.ndarray,
    settings: Settings,
    embed: bool = True,
    max_faces: int = 0,
) -> List[AnalyzedFace]:
    """Detect faces in an image, assess quality, and optionally embed them.

    Faces are returned best-detection-score first. ``max_faces`` <= 0 means
    no cap.
    """
    faces = engine.app.get(image_bgr) or []
    if max_faces > 0:
        faces = faces[:max_faces]

    results: List[AnalyzedFace] = []
    for face in faces:
        bbox = [float(v) for v in face.bbox]
        landmarks = (
            [[float(v) for v in kp] for kp in face.kps]
            if face.kps is not None
            else None
        )
        quality = assess_face(
            image_bgr, bbox, landmarks, float(face.det_score), settings
        )

        embedding = None
        if embed:
            raw = getattr(face, "normed_embedding", None)
            if raw is not None and raw.size > 0:
                embedding = np.asarray(raw, dtype=np.float64)

        x1, y1, x2, y2 = bbox
        results.append(
            AnalyzedFace(
                bbox=BoundingBox(
                    x=x1,
                    y=y1,
                    width=float(max(0.0, x2 - x1)),
                    height=float(max(0.0, y2 - y1)),
                ),
                confidence=float(face.det_score),
                quality=quality,
                embedding=embedding,
            )
        )
    return results
