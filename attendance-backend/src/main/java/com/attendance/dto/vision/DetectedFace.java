package com.attendance.dto.vision;

import java.util.List;

/**
 * One detected face with its quality assessment, as returned by the vision
 * service {@code POST /detect} endpoint (camera-guidance preview).
 */
public record DetectedFace(
        BoundingBox bbox,
        double confidence,
        FaceQuality quality) {
}
