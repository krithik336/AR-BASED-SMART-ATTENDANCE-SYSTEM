package com.attendance.dto;

import java.time.Instant;
import java.util.List;

public record ScanResponse(
        Long sessionId,
        int facesDetected,
        int recognized,
        int unknown,
        Instant timestamp,
        List<RecognizedFace> results) {
}
