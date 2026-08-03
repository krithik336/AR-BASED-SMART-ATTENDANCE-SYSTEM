package com.attendance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class ClassRoomRequest {

    @NotBlank(message = "Class name is required")
    @Size(max = 100, message = "Class name must be at most 100 characters")
    private String name;

    @NotBlank(message = "Class code is required")
    @Pattern(regexp = "^[A-Za-z0-9_-]{2,20}$",
            message = "Class code must be 2-20 characters: letters, digits, '-' or '_'")
    private String code;

    @Size(max = 500, message = "Description must be at most 500 characters")
    private String description;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
