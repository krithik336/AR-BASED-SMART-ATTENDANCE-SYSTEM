package com.attendance.controller;

import com.attendance.dto.AttendanceScanRequest;
import com.attendance.dto.CaptureUploadResponse;
import com.attendance.dto.ReviewOverrideRequest;
import com.attendance.dto.ReviewRecordResponse;
import com.attendance.dto.ScanResponse;
import com.attendance.dto.SessionResponse;
import com.attendance.dto.SessionReviewResponse;
import com.attendance.dto.vision.DetectResult;
import com.attendance.service.AttendanceService;
import com.attendance.service.AttendanceSessionService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final AttendanceSessionService sessionService;

    public AttendanceController(AttendanceService attendanceService, AttendanceSessionService sessionService) {
        this.attendanceService = attendanceService;
        this.sessionService = sessionService;
    }

    /**
     * Legacy live-scan: recognises faces in one webcam frame and updates
     * PRESENT records for the active session.
     */
    @PostMapping("/scan")
    public ResponseEntity<ScanResponse> scan(@Valid @RequestBody AttendanceScanRequest request) {
        return ResponseEntity.ok(attendanceService.scan(request));
    }

    /**
     * Camera-guidance preview proxy: detects every face in a JPEG frame and
     * assesses quality (no recognition). Used to show green/yellow/red boxes
     * while the teacher positions the camera.
     */
    @PostMapping(value = "/detect", consumes = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<DetectResult> detect(@RequestBody byte[] image) {
        return ResponseEntity.ok(attendanceService.detect(image));
    }

    /**
     * Uploads one high-resolution classroom image for an attendance session,
     * processes it (detect + quality + match + margin) and merges evidence
     * into the session's attendance records.
     */
    @PostMapping(value = "/captures", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CaptureUploadResponse> uploadCapture(
            @RequestParam("sessionId") Long sessionId,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(attendanceService.processCapture(sessionId, file));
    }

    /** Full review state of a session (recognized / review / not detected). */
    @GetMapping("/sessions/{sessionId}/review")
    public ResponseEntity<SessionReviewResponse> review(@PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionService.review(sessionId));
    }

    /** Teacher decision on one reviewed student (PRESENT or ABSENT). */
    @PostMapping("/sessions/{sessionId}/students/{studentId}/review")
    public ResponseEntity<ReviewRecordResponse> override(
            @PathVariable Long sessionId,
            @PathVariable Long studentId,
            @Valid @RequestBody ReviewOverrideRequest request) {
        return ResponseEntity.ok(sessionService.overrideStatus(sessionId, studentId, request.getStatus()));
    }

    /** Finalises attendance after review: everyone not PRESENT becomes ABSENT. */
    @PostMapping("/sessions/{sessionId}/submit")
    public ResponseEntity<SessionResponse> submit(@PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionService.submit(sessionId));
    }

    /** Abandons a session without producing a final attendance. */
    @PostMapping("/sessions/{sessionId}/cancel")
    public ResponseEntity<SessionResponse> cancel(@PathVariable Long sessionId) {
        return ResponseEntity.ok(sessionService.cancel(sessionId));
    }
}
