package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Score of one gallery candidate against a query face, as returned by the
 * vision service.
 */
public record MatchScore(
        @JsonProperty("student_id") long studentId,
        double distance,
        double score) {
}
