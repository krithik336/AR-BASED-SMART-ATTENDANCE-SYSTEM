package com.attendance.controller;

import com.attendance.dto.AttendanceScanRequest;
import com.attendance.dto.ScanResponse;
import com.attendance.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    /**
     * Recognises faces in one webcam frame and updates PRESENT records for the
     * active session. Supports multiple students per frame and reports unknown
     * faces without recording them.
     */
    @PostMapping("/scan")
    public ResponseEntity<ScanResponse> scan(@Valid @RequestBody AttendanceScanRequest request) {
        return ResponseEntity.ok(attendanceService.scan(request));
    }
}
