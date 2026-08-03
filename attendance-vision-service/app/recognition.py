"""ArcFace recognition layer.

Extracts L2-normalised 512-d embeddings from the ``w600k_r50`` recogniser in
the InsightFace ``buffalo_l`` pack. InsightFace already aligns crops using the
5 landmarks produced by the RetinaFace stage, so embedding quality matches the
canonical ArcFace pipeline.
"""
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .schemas import BoundingBox


@dataclass
class FaceEmbedding:
    """Normalised embedding plus the face geometry it was extracted from."""

    bbox: BoundingBox
    confidence: float
    embedding: np.ndarray  # 512-d, L2-normalised


def embed_faces(
    engine, image_bgr: np.ndarray, max_faces: int = 20
) -> List[FaceEmbedding]:
    """Detect faces and return one embedding per face, best-scoring first."""
    faces = engine.app.get(image_bgr) or []
    if max_faces > 0:
        faces = faces[:max_faces]

    results: List[FaceEmbedding] = []
    for face in faces:
        embedding = getattr(face, "normed_embedding", None)
        if embedding is None or embedding.size == 0:
            continue
        x1, y1, x2, y2 = [float(v) for v in face.bbox]
        results.append(
            FaceEmbedding(
                bbox=BoundingBox(
                    x=x1,
                    y=y1,
                    width=float(max(0.0, x2 - x1)),
                    height=float(max(0.0, y2 - y1)),
                ),
                confidence=float(face.det_score),
                embedding=np.asarray(embedding, dtype=np.float64),
            )
        )
    return results
