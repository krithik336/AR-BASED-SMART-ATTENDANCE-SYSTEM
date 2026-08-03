package com.attendance.controller;

import com.attendance.dto.SessionReportResponse;
import com.attendance.dto.SessionResponse;
import com.attendance.dto.SessionStartRequest;
import com.attendance.security.CurrentUser;
import com.attendance.service.AttendanceSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
public class AttendanceSessionController {

    private final AttendanceSessionService sessionService;
    private final CurrentUser currentUser;

    public AttendanceSessionController(AttendanceSessionService sessionService, CurrentUser currentUser) {
        this.sessionService = sessionService;
        this.currentUser = currentUser;
    }

    @PostMapping
    public ResponseEntity<SessionResponse> start(@Valid @RequestBody SessionStartRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(sessionService.start(currentUser.id(), request));
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<SessionResponse> end(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.end(id));
    }

    @GetMapping
    public ResponseEntity<List<SessionResponse>> listForTeacher() {
        return ResponseEntity.ok(sessionService.listForTeacher(currentUser.id()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.get(id));
    }

    @GetMapping("/{id}/report")
    public ResponseEntity<SessionReportResponse> report(@PathVariable Long id) {
        return ResponseEntity.ok(sessionService.report(id));
    }
}
