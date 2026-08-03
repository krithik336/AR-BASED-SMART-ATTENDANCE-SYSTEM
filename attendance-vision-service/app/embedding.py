"""Embedding orchestration: single-image and batch face embedding."""
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .recognition import embed_faces
from .schemas import BoundingBox, EmbedResult


@dataclass
class EmbeddingOutcome:
    face_detected: bool
    embedding: Optional[List[float]] = None
    confidence: Optional[float] = None
    bbox: Optional[BoundingBox] = None
    error: Optional[str] = None

    def to_schema(self) -> EmbedResult:
        return EmbedResult(
            face_detected=self.face_detected,
            embedding=self.embedding,
            confidence=self.confidence,
            bbox=self.bbox,
            error=self.error,
        )


def embed_image(engine, image_bgr: np.ndarray) -> EmbeddingOutcome:
    """Embed the single best-scoring face in one image."""
    faces = embed_faces(engine, image_bgr, max_faces=1)
    if not faces:
        return EmbeddingOutcome(face_detected=False, error="no face detected")
    face = faces[0]
    return EmbeddingOutcome(
        face_detected=True,
        embedding=[float(v) for v in face.embedding],
        confidence=face.confidence,
        bbox=face.bbox,
    )


def embed_images(engine, images: List[np.ndarray]) -> List[EmbeddingOutcome]:
    """Embed one best face per image, preserving input order."""
    return [embed_image(engine, image) for image in images]
