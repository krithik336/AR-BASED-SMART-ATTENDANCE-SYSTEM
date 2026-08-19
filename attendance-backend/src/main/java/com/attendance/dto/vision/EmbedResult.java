package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record EmbedResult(
        @JsonProperty("face_detected") boolean faceDetected,
        List<Double> embedding,
        Double confidence,
        BoundingBox bbox,
        String error,
        FaceQuality quality) {
}
