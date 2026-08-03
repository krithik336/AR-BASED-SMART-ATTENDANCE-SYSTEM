package com.attendance.dto;

import com.attendance.dto.vision.BoundingBox;

/**
 * Recognition result for one face in a scanned frame. Unknown faces carry a
 * null {@code studentId} / {@code studentName}.
 */
public record RecognizedFace(
        Long studentId,
        String studentName,
        String rollNumber,
        double similarity,
        double confidence,
        boolean matched,
        boolean marked,
        BoundingBox bbox) {
}
