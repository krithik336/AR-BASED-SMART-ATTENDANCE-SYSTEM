from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import get_settings
from .models import FaceRecognitionEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    engine = FaceRecognitionEngine.get()
    if settings.warmup_on_startup:
        engine.warmup_in_background()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "Face detection (RetinaFace) and recognition (ArcFace) via "
            "InsightFace buffalo_l on ONNX Runtime."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    return application


app = create_app()
