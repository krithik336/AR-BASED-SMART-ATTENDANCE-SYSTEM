"""Embedding orchestration: single-image and batch face embedding.

Enrollment semantics: a student photo must contain exactly one usable face.
Images with no face, multiple faces, or a poor-quality face are rejected with a
descriptive error. The single-image ``/embed`` endpoint keeps the older
"best face" behaviour (it is not used for enrollment).
"""
from dataclasses import dataclass
from typing import List, Optional

import numpy as np

from .analysis import analyze_faces
from .schemas import BoundingBox, EmbedResult, FaceQuality


@dataclass
class EmbeddingOutcome:
    face_detected: bool
    embedding: Optional[List[float]] = None
    confidence: Optional[float] = None
    bbox: Optional[BoundingBox] = None
    quality: Optional[FaceQuality] = None
    error: Optional[str] = None

    def to_schema(self) -> EmbedResult:
        return EmbedResult(
            face_detected=self.face_detected,
            embedding=self.embedding,
            confidence=self.confidence,
            bbox=self.bbox,
            quality=self.quality,
            error=self.error,
        )


def embed_best_face(engine, image_bgr: np.ndarray, settings) -> EmbeddingOutcome:
    """Embed the single best-scoring face in one image (never rejects)."""
    faces = analyze_faces(engine, image_bgr, settings, embed=True, max_faces=1)
    if not faces:
        return EmbeddingOutcome(face_detected=False, error="no face detected")
    face = faces[0]
    return EmbeddingOutcome(
        face_detected=True,
        embedding=[float(v) for v in face.embedding] if face.embedding is not None else None,
        confidence=face.confidence,
        bbox=face.bbox,
        quality=face.quality.to_schema(),
    )


def embed_enrollment_photo(engine, image_bgr: np.ndarray, settings) -> EmbeddingOutcome:
    """Strict enrollment embed: exactly one face, quality must not be POOR."""
    faces = analyze_faces(engine, image_bgr, settings, embed=True, max_faces=0)
    if not faces:
        return EmbeddingOutcome(face_detected=False, error="no face detected")

    if len(faces) > 1:
        return EmbeddingOutcome(
            face_detected=False,
            error=f"multiple faces detected ({len(faces)}); exactly one is required",
        )

    face = faces[0]
    if face.quality.verdict == "POOR":
        reasons = ", ".join(face.quality.reasons) or "face quality too poor"
        return EmbeddingOutcome(
            face_detected=False,
            error=f"face quality rejected: {reasons}",
            quality=face.quality.to_schema(),
        )

    return EmbeddingOutcome(
        face_detected=True,
        embedding=[float(v) for v in face.embedding] if face.embedding is not None else None,
        confidence=face.confidence,
        bbox=face.bbox,
        quality=face.quality.to_schema(),
    )


def embed_image(engine, image_bgr: np.ndarray, settings) -> EmbeddingOutcome:
    """Best-face embedding (legacy behaviour)."""
    return embed_best_face(engine, image_bgr, settings)


def embed_images(engine, images: List[np.ndarray], settings) -> List[EmbeddingOutcome]:
    """Strict enrollment embedding for a batch of images, preserving order."""
    return [embed_enrollment_photo(engine, image, settings) for image in images]