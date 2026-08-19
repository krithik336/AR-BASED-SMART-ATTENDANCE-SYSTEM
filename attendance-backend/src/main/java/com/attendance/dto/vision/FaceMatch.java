package com.attendance.dto.vision;

import java.util.List;

/**
 * Recognition outcome for a single detected face in a frame.
 */
public record FaceMatch(
        BoundingBox bbox,
        double confidence,
        boolean matched,
        MatchScore best,
        List<MatchScore> candidates,
        FaceQuality quality) {
}
