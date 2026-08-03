package com.attendance.dto;

import com.attendance.model.AttendanceStatus;

import java.time.Instant;

public record AttendanceRecordResponse(
        Long studentId,
        String studentName,
        String rollNumber,
        AttendanceStatus status,
        double similarity,
        Instant markedAt) {
}
