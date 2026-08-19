import base64
import binascii
from typing import List

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..analysis import analyze_faces
from ..config import Settings, get_settings
from ..embedding import EmbeddingOutcome, embed_image, embed_images
from ..models import FaceRecognitionEngine, ModelNotReadyError
from ..schemas import (
    BoundingBox,
    CandidateFace,
    DetectResponse,
    DetectedFace,
    EmbedBatchResponse,
    EmbedResult,
    FaceMatch,
    HealthResponse,
    MatchRequest,
    MatchResponse,
    MatchScore,
)
from ..similarity import cosine_similarity, validate_embedding_size
from ..utils.image_utils import (
    InvalidImageError,
    decode_base64_image,
    decode_raw_image,
    limit_max_dimension,
)

router = APIRouter()


def get_engine() -> FaceRecognitionEngine:
    return FaceRecognitionEngine.get()


def _guard_ready(engine: FaceRecognitionEngine) -> None:
    try:
        engine.ensure_ready()
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _validate_payload_size(data: bytes, settings: Settings) -> None:
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds the {settings.max_upload_bytes} byte limit",
        )


def _prepare_image(data: bytes, settings: Settings) -> np.ndarray:
    try:
        image = decode_raw_image(data)
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return limit_max_dimension(image, settings.max_image_size)


@router.get("/health", response_model=HealthResponse)
def health(
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    state = engine.health()
    return HealthResponse(
        status=state["status"],
        model_loaded=state["model_loaded"],
        service=settings.app_name,
        version=settings.version,
    )


@router.post("/detect", response_model=DetectResponse)
async def detect(
    request: Request,
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> DetectResponse:
    """Detect every face in an image and assess quality (no embeddings).

    Lightweight enough for repeated camera-guidance previews.
    """
    _guard_ready(engine)
    data = await request.body()
    _validate_payload_size(data, settings)
    image = await run_in_threadpool(_prepare_image, data, settings)

    def _run() -> DetectResponse:
        faces = analyze_faces(
            engine,
            image,
            settings,
            embed=False,
            max_faces=settings.max_faces_per_frame,
        )
        return DetectResponse(
            face_count=len(faces),
            faces=[
                DetectedFace(bbox=f.bbox, confidence=f.confidence, quality=f.quality.to_schema())
                for f in faces
            ],
        )

    return await run_in_threadpool(_run)


@router.post("/embed", response_model=EmbedResult)
async def embed(
    request: Request,
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> EmbedResult:
    """Embed the best face in one uploaded image (raw JPEG/PNG/WebP bytes)."""
    _guard_ready(engine)
    data = await request.body()
    _validate_payload_size(data, settings)
    image = await run_in_threadpool(_prepare_image, data, settings)
    outcome = await run_in_threadpool(_embed_one, engine, image, settings)
    return outcome.to_schema()


@router.post("/embed/batch", response_model=EmbedBatchResponse)
async def embed_batch(
    files: List[UploadFile] = File(...),
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> EmbedBatchResponse:
    """Enroll: exactly one usable face per image, one embedding per image.

    Images with no face, multiple faces, or a poor-quality face are reported
    per-image (face_detected=false + error) and skipped, never fatal.
    """
    _guard_ready(engine)
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")
    if len(files) > settings.max_files_per_batch:
        raise HTTPException(
            status_code=400,
            detail=f"At most {settings.max_files_per_batch} files per request",
        )

    images: List[np.ndarray] = []
    for file in files:
        data = await file.read()
        _validate_payload_size(data, settings)
        try:
            images.append(_prepare_image(data, settings))
        except HTTPException:
            # Corrupt/unsupported files are reported per-image, not fatal.
            images.append(None)

    outcomes = await run_in_threadpool(_embed_many, engine, images, settings)
    results = [o.to_schema() for o in outcomes]
    processed = sum(1 for r in results if r.face_detected)
    return EmbedBatchResponse(processed=processed, results=results)


@router.post("/match", response_model=MatchResponse)
async def match(
    payload: MatchRequest,
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> MatchResponse:
    """Match every face in a base64 image against the enrolled gallery.

    Each face carries its quality assessment; faces the backend deems POOR are
    meant to be rejected (the backend owns the final decision).
    """
    _guard_ready(engine)
    threshold = (
        payload.threshold
        if payload.threshold is not None
        else settings.similarity_threshold
    )

    def _run() -> MatchResponse:
        try:
            image = limit_max_dimension(
                decode_base64_image(payload.image_base64), settings.max_image_size
            )
        except InvalidImageError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        faces = analyze_faces(
            engine, image, settings, embed=True, max_faces=settings.max_faces_per_frame
        )
        results = [
            _match_face(face.embedding, face.bbox, face.confidence, face.quality.to_schema(),
                        payload.candidates, threshold)
            for face in faces
            if face.embedding is not None
        ]
        return MatchResponse(
            face_count=len(results), threshold=threshold, faces=results
        )

    return await run_in_threadpool(_run)


def _embed_one(engine: FaceRecognitionEngine, image: np.ndarray, settings: Settings) -> EmbeddingOutcome:
    return embed_image(engine, image, settings)


def _embed_many(
    engine: FaceRecognitionEngine, images: List[np.ndarray], settings: Settings
) -> List[EmbeddingOutcome]:
    return [
        embed_image(engine, image, settings)
        if image is not None
        else EmbeddingOutcome(face_detected=False, error="invalid image")
        for image in images
    ]


def _match_face(
    query: np.ndarray,
    bbox: BoundingBox,
    confidence: float,
    quality,
    candidates: List[CandidateFace],
    threshold: float,
) -> FaceMatch:
    scores: List[MatchScore] = []
    for candidate in candidates:
        vector = np.asarray(candidate.embedding, dtype=np.float64)
        if not validate_embedding_size(vector, query.size):
            continue
        score = cosine_similarity(query, vector)
        scores.append(
            MatchScore(
                student_id=candidate.student_id,
                distance=1.0 - score,
                score=score,
            )
        )

    scores.sort(key=lambda s: s.score, reverse=True)
    matched = bool(scores) and scores[0].score >= threshold
    best = scores[0] if matched else None
    return FaceMatch(
        bbox=bbox,
        confidence=confidence,
        matched=matched,
        best=best,
        candidates=scores,
        quality=quality,
    )
