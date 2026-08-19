package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record MatchResult(
        @JsonProperty("face_count") int faceCount,
        double threshold,
        List<FaceMatch> faces) {
}