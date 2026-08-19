package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Per-face quality assessment produced by the vision service. Mirrors the
 * snake_case JSON contract of the FastAPI {@code FaceQuality} schema.
 *
 * <p>{@code verdict} drives camera guidance (GOOD=green, WARNING=yellow,
 * POOR=red) and capture processing (POOR faces are rejected).
 */
public record FaceQuality(
        double score,
        @JsonProperty("size_ok") boolean sizeOk,
        @JsonProperty("blur_ok") boolean blurOk,
        @JsonProperty("brightness_ok") boolean brightnessOk,
        @JsonProperty("pose_ok") boolean poseOk,
        @JsonProperty("occlusion_ok") boolean occlusionOk,
        List<String> reasons,
        QualityVerdict verdict) {
}
