package com.attendance.dto;

import com.attendance.model.SessionStatus;

import java.time.Instant;

public record SessionResponse(
        Long id,
        Long classId,
        String className,
        Long teacherId,
        String subject,
        Instant startedAt,
        Instant endedAt,
        SessionStatus status,
        long totalStudents,
        long present,
        long absent,
        long unverified,
        long review,
        long photos) {
}
