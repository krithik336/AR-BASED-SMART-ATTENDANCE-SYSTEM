package com.attendance.dto;

import com.attendance.model.AttendanceStatus;

import java.time.Instant;

/**
 * One student row in the attendance review screen.
 * Students with no evidence yet carry {@code UNVERIFIED}.
 */
public record ReviewRecordResponse(
        Long studentId,
        String studentName,
        String rollNumber,
        AttendanceStatus status,
        double similarity,
        double margin,
        int evidenceCount,
        Long captureId,
        Instant markedAt) {
}
