import base64
import binascii

import cv2
import numpy as np


class InvalidImageError(Exception):
    """Raised when a payload cannot be decoded as a valid image."""


def decode_raw_image(data: bytes) -> np.ndarray:
    """Decode raw image bytes (JPEG/PNG/WebP/BMP) into an OpenCV BGR array."""
    if not data:
        raise InvalidImageError("Empty image payload")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise InvalidImageError(
            "Could not decode image; expected JPEG/PNG/WebP/BMP bytes"
        )
    return image


def decode_base64_image(payload: str) -> np.ndarray:
    """Decode a base64 image, tolerating an optional ``data:...;base64,`` prefix."""
    if not payload:
        raise InvalidImageError("Empty base64 image")
    b64 = payload.split(",", 1)[1] if "," in payload else payload
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImageError("Invalid base64 image payload") from exc
    return decode_raw_image(data)


def limit_max_dimension(image: np.ndarray, max_size: int) -> np.ndarray:
    """Downscale images wider or taller than ``max_size`` pixels.

    Keeps memory bounded: the detector then resizes to its own working size
    (e.g. 640x640) regardless of input resolution.
    """
    height, width = image.shape[:2]
    longest = max(width, height)
    if longest <= max_size:
        return image
    scale = max_size / float(longest)
    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
