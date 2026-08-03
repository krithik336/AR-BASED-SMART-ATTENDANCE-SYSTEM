package com.attendance.dto;

import java.util.List;

public record SessionReportResponse(
        SessionResponse session,
        List<AttendanceRecordResponse> records) {
}
