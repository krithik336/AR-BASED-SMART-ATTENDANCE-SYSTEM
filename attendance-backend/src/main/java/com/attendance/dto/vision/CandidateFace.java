package com.attendance.dto.vision;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record CandidateFace(
        @JsonProperty("student_id") long studentId,
        List<Double> embedding) {
}
