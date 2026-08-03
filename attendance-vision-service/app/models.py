import os
import threading
from typing import List, Optional, Tuple

import numpy as np
import onnxruntime
from insightface.app import FaceAnalysis

from .config import Settings, get_settings


class ModelNotReadyError(RuntimeError):
    """Raised when a recognition endpoint is called before the model is warm."""


class FaceRecognitionEngine:
    """Lazy singleton wrapping the InsightFace ``buffalo_l`` pipeline.

    Bundles RetinaFace detection (``det_500m``) and ArcFace recognition
    (``w600k_r50``) on a shared ONNX Runtime session set. The model pack is
    downloaded automatically by insightface on first run when missing.
    """

    _instance: Optional["FaceRecognitionEngine"] = None
    _instance_lock = threading.Lock()

    def __init__(self, settings: Settings):
        self.settings = settings
        self.app: Optional[FaceAnalysis] = None
        self.provider: str = "uninitialized"
        self.error: Optional[str] = None
        self._ready = False
        self._init_lock = threading.Lock()
        self._warmup_thread: Optional[threading.Thread] = None

    @classmethod
    def get(cls) -> "FaceRecognitionEngine":
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls(get_settings())
        return cls._instance

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def model_loaded(self) -> bool:
        return self.app is not None and self._ready

    def init(self) -> None:
        if self._ready:
            return
        with self._init_lock:
            if self._ready:
                return
            try:
                providers, ctx_id = self._resolve_providers()
                self.app = FaceAnalysis(
                    name=self.settings.model_name,
                    root=os.path.expanduser(self.settings.model_root),
                    providers=providers,
                )
                self.app.prepare(
                    ctx_id=ctx_id,
                    det_thresh=self.settings.detection_threshold,
                    det_size=self.settings.detection_size,
                )
                self.provider = providers[0]
                self._ready = True
                self.error = None
            except Exception as exc:  # model pack missing, provider error, ...
                self.error = str(exc)
                raise ModelNotReadyError(
                    f"Failed to load {self.settings.model_name}: {exc}"
                ) from exc

    def warmup_in_background(self) -> None:
        """Load the model off the request path so /health reports 'loading' meanwhile."""

        def _run() -> None:
            try:
                self.init()
                # Force a real inference so onnxruntime materialises the graph and
                # the model weights are resident in memory before traffic arrives.
                dummy = np.zeros((640, 640, 3), dtype=np.uint8)
                self.app.get(dummy)
            except ModelNotReadyError as exc:
                self.error = str(exc)

        self._warmup_thread = threading.Thread(
            target=_run, daemon=True, name="vision-warmup"
        )
        self._warmup_thread.start()

    def ensure_ready(self) -> None:
        if not self._ready:
            raise ModelNotReadyError(
                self.error or "Face model is still loading (see /health)"
            )

    def _resolve_providers(self) -> Tuple[List[str], int]:
        """Pick ONNX Runtime providers + the InsightFace ``ctx_id`` convention.

        ``ctx_id`` >= 0 selects CUDA (device index), ``-1`` selects CPU.
        """
        available = onnxruntime.get_available_providers()
        mode = self.settings.onnx_provider.strip().lower()

        if mode == "cuda":
            if "CUDAExecutionProvider" not in available:
                raise ModelNotReadyError(
                    "CUDAExecutionProvider requested but not available "
                    f"(installed providers: {', '.join(available)})"
                )
            return ["CUDAExecutionProvider", "CPUExecutionProvider"], 0

        if mode == "cpu":
            return ["CPUExecutionProvider"], -1

        if "CUDAExecutionProvider" in available:
            return ["CUDAExecutionProvider", "CPUExecutionProvider"], 0
        return ["CPUExecutionProvider"], -1

    def health(self) -> dict:
        if self._ready:
            return {"status": "ok", "model_loaded": True}
        if self.error:
            return {"status": "error", "model_loaded": False}
        return {"status": "loading", "model_loaded": False}
