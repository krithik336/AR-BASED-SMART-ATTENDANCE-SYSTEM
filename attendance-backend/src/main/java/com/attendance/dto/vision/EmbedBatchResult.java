package com.attendance.dto.vision;

import java.util.List;

public record EmbedBatchResult(
        int processed,
        List<EmbedResult> results) {
}
