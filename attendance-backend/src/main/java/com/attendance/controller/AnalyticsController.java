package com.attendance.controller;

import com.attendance.dto.AnalyticsResponse;
import com.attendance.security.CurrentUser;
import com.attendance.service.AnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final CurrentUser currentUser;

    public AnalyticsController(AnalyticsService analyticsService, CurrentUser currentUser) {
        this.analyticsService = analyticsService;
        this.currentUser = currentUser;
    }

    /** Admin: all classes */
    @GetMapping
    public ResponseEntity<AnalyticsResponse> adminAnalytics(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.buildForAdmin(Math.min(days, 365)));
    }

    /** Teacher: only their assigned classes */
    @GetMapping("/my")
    public ResponseEntity<AnalyticsResponse> teacherAnalytics(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(analyticsService.buildForTeacher(currentUser.id(), Math.min(days, 365)));
    }
}
