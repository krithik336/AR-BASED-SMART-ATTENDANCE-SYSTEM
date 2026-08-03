package com.attendance.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class StudentRequest {

    @NotBlank(message = "Student name is required")
    @Size(max = 120, message = "Student name must be at most 120 characters")
    private String name;

    @NotBlank(message = "Roll number is required")
    @Pattern(regexp = "^[A-Za-z0-9-_]+$", message = "Roll number may contain letters, digits, '-' and '_'")
    @Size(max = 40, message = "Roll number must be at most 40 characters")
    private String rollNumber;

    @Email(message = "Email must be valid")
    @Size(max = 120, message = "Email must be at most 120 characters")
    private String email;

    @NotNull(message = "Class id is required")
    private Long classId;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRollNumber() { return rollNumber; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Long getClassId() { return classId; }
    public void setClassId(Long classId) { this.classId = classId; }
}
