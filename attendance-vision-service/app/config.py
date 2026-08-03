from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven configuration (see ``.env.example``)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=(),
    )

    app_name: str = "attendance-vision-service"
    version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # --- Face model ----------------------------------------------------------
    model_name: str = "buffalo_l"
    # Base directory insightface uses; the pack is looked up at
    # <model_root>/models/<model_name>.
    model_root: str = str(Path.home() / ".insightface")
    # "auto" | "cpu" | "cuda" - provider selection for ONNX Runtime
    onnx_provider: str = "auto"

    # --- Detection (RetinaFace) ----------------------------------------------
    detection_threshold: float = 0.5
    detection_size: tuple[int, int] = (640, 640)
    max_faces_per_frame: int = 20

    # --- Recognition (ArcFace) -------------------------------------------------
    embedding_size: int = 512
    # Fallback threshold used when /match omits "threshold". The Spring Boot
    # backend owns the authoritative threshold (app.recognition.threshold).
    similarity_threshold: float = 0.6
    top_k_candidates: int = 5

    # --- Request guards ---------------------------------------------------------
    max_image_size: int = 2048
    max_upload_bytes: int = 15 * 1024 * 1024
    max_files_per_batch: int = 10

    # --- Warmup -----------------------------------------------------------------
    warmup_on_startup: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
