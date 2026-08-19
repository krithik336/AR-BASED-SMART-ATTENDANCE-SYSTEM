package com.attendance.dto;

import java.util.List;

/**
 * Full review state of an attendance session before final submission.
 */
public record SessionReviewResponse(
        SessionResponse session,
        long totalStudents,
        long recognized,
        long needsReview,
        long notDetected,
        long photosCaptured,
        List<ReviewRecordResponse> records) {
}
