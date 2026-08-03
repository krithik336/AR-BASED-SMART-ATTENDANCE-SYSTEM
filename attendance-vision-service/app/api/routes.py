import base64
import binascii
from typing import List

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..config import Settings, get_settings
from ..embedding import EmbeddingOutcome, embed_image, embed_images
from ..models import FaceRecognitionEngine, ModelNotReadyError
from ..recognition import embed_faces
from ..schemas import (
    BoundingBox,
    CandidateFace,
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
    outcome = await run_in_threadpool(_embed_one, engine, image)
    return outcome.to_schema()


@router.post("/embed/batch", response_model=EmbedBatchResponse)
async def embed_batch(
    files: List[UploadFile] = File(...),
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> EmbedBatchResponse:
    """Embed the best face of each uploaded image in one request."""
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

    outcomes = await run_in_threadpool(_embed_many, engine, images)
    results = [o.to_schema() for o in outcomes]
    processed = sum(1 for r in results if r.face_detected)
    return EmbedBatchResponse(processed=processed, results=results)


@router.post("/match", response_model=MatchResponse)
async def match(
    payload: MatchRequest,
    engine: FaceRecognitionEngine = Depends(get_engine),
    settings: Settings = Depends(get_settings),
) -> MatchResponse:
    """Match every face in a base64 frame against the enrolled gallery."""
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

        faces = embed_faces(
            engine, image, max_faces=settings.max_faces_per_frame
        )
        results = [_match_face(face.embedding, face.bbox, face.confidence, payload.candidates, threshold)
                   for face in faces]
        return MatchResponse(
            face_count=len(results), threshold=threshold, faces=results
        )

    return await run_in_threadpool(_run)


def _embed_one(engine: FaceRecognitionEngine, image: np.ndarray) -> EmbeddingOutcome:
    return embed_image(engine, image)


def _embed_many(
    engine: FaceRecognitionEngine, images: List[np.ndarray]
) -> List[EmbeddingOutcome]:
    return [
        embed_image(engine, image)
        if image is not None
        else EmbeddingOutcome(face_detected=False, error="invalid image")
        for image in images
    ]


def _match_face(
    query: np.ndarray,
    bbox: BoundingBox,
    confidence: float,
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
    )
