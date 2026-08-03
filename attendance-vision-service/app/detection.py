"""RetinaFace detection layer.

Thin wrapper around the ``det_500m`` detector shipped inside the InsightFace
``buffalo_l`` pack. The pipeline is executed through the shared engine so a
single ONNX Runtime session set is reused for detection and recognition.
"""
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .schemas import BoundingBox


@dataclass
class Detection:
    """One detected face in image pixel coordinates."""

    bbox: List[float]  # [x1, y1, x2, y2]
    confidence: float  # detection score
    landmarks: Optional[List[List[float]]] = None  # 5 facial landmarks (5 x 2)


def to_bounding_box(xyxy: List[float]) -> BoundingBox:
    x1, y1, x2, y2 = xyxy
    return BoundingBox(
        x=float(x1),
        y=float(y1),
        width=float(max(0.0, x2 - x1)),
        height=float(max(0.0, y2 - y1)),
    )


def detect_faces(
    engine, image_bgr: np.ndarray, max_faces: int = 20
) -> List[Detection]:
    """Run RetinaFace over an image and return detections sorted by score.

    ``engine`` is the :class:`app.models.FaceRecognitionEngine` singleton; its
    ``app.get()`` returns faces ordered by descending detection score.
    """
    faces = engine.app.get(image_bgr) or []
    if max_faces > 0:
        faces = faces[:max_faces]

    detections: List[Detection] = []
    for face in faces:
        landmarks = (
            [[float(v) for v in kp] for kp in face.kps]
            if face.kps is not None
            else None
        )
        detections.append(
            Detection(
                bbox=[float(v) for v in face.bbox],
                confidence=float(face.det_score),
                landmarks=landmarks,
            )
        )
    return detections


def has_face(engine, image_bgr: np.ndarray) -> bool:
    faces = engine.app.get(image_bgr)
    return bool(faces)
