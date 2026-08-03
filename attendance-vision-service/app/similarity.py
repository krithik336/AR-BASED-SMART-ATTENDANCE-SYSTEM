"""Vector-math helpers for cosine similarity over ArcFace embeddings."""
from typing import Optional

import numpy as np


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector)
    if norm < 1e-12:
        return vector
    return vector / norm


def validate_embedding_size(vector, expected: int) -> bool:
    if vector is None:
        return False
    try:
        return int(np.asarray(vector).size) == expected
    except (TypeError, ValueError):
        return False


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-12
    return float(np.dot(a, b) / denom)


def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    return 1.0 - cosine_similarity(a, b)


def cosine_similarity_batch(
    query: np.ndarray, gallery: np.ndarray
) -> np.ndarray:
    """Scores for every pair: query (N, D) x gallery (M, D) -> (N, M)."""
    query_norm = query / (np.linalg.norm(query, axis=1, keepdims=True) + 1e-12)
    gallery_norm = gallery / (np.linalg.norm(gallery, axis=1, keepdims=True) + 1e-12)
    return query_norm @ gallery_norm.T
