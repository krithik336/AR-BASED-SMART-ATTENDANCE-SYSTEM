from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str
    model_loaded: bool
    service: str
    version: str


class FaceQuality(BaseModel):
    score: float
    size_ok: bool
    blur_ok: bool
    brightness_ok: bool
    pose_ok: bool
    occlusion_ok: bool
    reasons: List[str] = Field(default_factory=list)
    # "GOOD" | "WARNING" | "POOR"
    verdict: str


class DetectedFace(BaseModel):
    bbox: BoundingBox
    confidence: float
    quality: FaceQuality


class DetectResponse(BaseModel):
    face_count: int
    faces: List[DetectedFace] = Field(default_factory=list)


class EmbedResult(BaseModel):
    face_detected: bool
    embedding: Optional[List[float]] = None
    confidence: Optional[float] = None
    bbox: Optional[BoundingBox] = None
    quality: Optional[FaceQuality] = None
    error: Optional[str] = None


class EmbedBatchResponse(BaseModel):
    processed: int
    results: List[EmbedResult]


class CandidateFace(BaseModel):
    student_id: int
    embedding: List[float]


class MatchRequest(BaseModel):
    image_base64: str
    candidates: List[CandidateFace] = Field(default_factory=list)
    threshold: Optional[float] = None


class MatchScore(BaseModel):
    student_id: int
    distance: float
    score: float


class FaceMatch(BaseModel):
    bbox: BoundingBox
    confidence: float
    matched: bool
    best: Optional[MatchScore] = None
    candidates: List[MatchScore] = Field(default_factory=list)
    quality: Optional[FaceQuality] = None


class MatchResponse(BaseModel):
    face_count: int
    threshold: float
    faces: List[FaceMatch] = Field(default_factory=list)
