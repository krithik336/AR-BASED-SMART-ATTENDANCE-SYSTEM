package com.attendance.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class SessionStartRequest {

    @NotNull(message = "Class id is required")
    private Long classId;

    @Size(max = 300, message = "Subject must be at most 300 characters")
    private String subject;

    public Long getClassId() { return classId; }
    public void setClassId(Long classId) { this.classId = classId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
}
