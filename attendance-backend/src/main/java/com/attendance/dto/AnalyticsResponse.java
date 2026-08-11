package com.attendance.dto;

import java.util.List;

public record AnalyticsResponse(
        // Summary stats
        long totalStudents,
        long totalClasses,
        long totalTeachers,
        double todayAttendancePct,

        // Trend: list of {date, presentCount, totalCount, pct}
        List<DailyTrend> trend,

        // Overall present vs absent across the window
        long overallPresent,
        long overallAbsent,

        // Per-class attendance %
        List<ClassAttendance> classAttendance,

        // Distribution buckets
        long above90,
        long between75and89,
        long below75,

        // Low attendance students
        List<LowAttendanceStudent> lowAttendanceStudents,

        // Recent sessions
        List<RecentSession> recentSessions
) {
    public record DailyTrend(String date, long present, long total, double pct) {}
    public record ClassAttendance(String className, double pct, long present, long total) {}
    public record LowAttendanceStudent(Long studentId, String name, String rollNumber, String className, double pct) {}
    public record RecentSession(String date, String className, long present, long absent, double pct) {}
}
