package com.attendance.dto;

import java.time.Instant;

public record StudentResponse(
        Long id,
        String name,
        String rollNumber,
        String email,
        Long classId,
        String className,
        boolean faceRegistered,
        boolean active,
        int photoCount,
        int embeddingCount,
        Instant createdAt) {
}
