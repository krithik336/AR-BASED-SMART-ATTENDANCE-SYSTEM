package com.attendance.dto;

import java.time.Instant;

public record ClassRoomResponse(
        Long id,
        String name,
        String code,
        String description,
        long studentCount,
        Instant createdAt) {
}
