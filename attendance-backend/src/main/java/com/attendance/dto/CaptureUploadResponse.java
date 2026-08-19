package com.attendance.dto;

import com.attendance.model.CaptureStatus;

/**
 * Result of processing one uploaded classroom image for an attendance session.
 */
public record CaptureUploadResponse(
        Long sessionId,
        Long captureId,
        int faceCount,
        int recognized,
        int needsReview,
        int unknown,
        int rejected,
        CaptureStatus status,
        String error) {
}
