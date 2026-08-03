package com.attendance.dto.vision;

import java.util.List;

/**
 * Result of matching every face in one frame against the enrolled gallery.
 */
public record MatchResult(
        int faceCount,
        double threshold,
        List<FaceMatch> faces) {
}
