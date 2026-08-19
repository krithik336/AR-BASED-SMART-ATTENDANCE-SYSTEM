package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Response of the vision service {@code POST /detect} endpoint: every face in
 * an image plus its quality verdict. No embeddings are computed, so this is
 * cheap enough to run repeatedly for live camera guidance.
 */
public record DetectResult(
        @JsonProperty("face_count") int faceCount,
        List<DetectedFace> faces) {
}
