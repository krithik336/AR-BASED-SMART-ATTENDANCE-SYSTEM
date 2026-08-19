package com.attendance.dto;

import com.attendance.model.AttendanceStatus;
import jakarta.validation.constraints.NotNull;

public class ReviewOverrideRequest {

    @NotNull(message = "Status is required")
    private AttendanceStatus status;

    public AttendanceStatus getStatus() { return status; }
    public void setStatus(AttendanceStatus status) { this.status = status; }
}
