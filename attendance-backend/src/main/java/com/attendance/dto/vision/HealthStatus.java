package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

public record HealthStatus(
        String status,
        @JsonProperty("model_loaded") boolean modelLoaded,
        String service,
        String version) {
}
