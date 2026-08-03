package com.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class AttendanceScanRequest {

    @NotNull(message = "Session id is required")
    private Long sessionId;

    @NotBlank(message = "Frame image is required")
    @Size(max = 4_000_000, message = "Frame image is too large")
    private String imageBase64;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public String getImageBase64() { return imageBase64; }
    public void setImageBase64(String imageBase64) { this.imageBase64 = imageBase64; }
}
