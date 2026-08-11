package com.attendance.service;

import com.attendance.dto.AnalyticsResponse;
import com.attendance.dto.AnalyticsResponse.*;
import com.attendance.model.Attendance;
import com.attendance.model.AttendanceSession;
import com.attendance.model.AttendanceStatus;
import com.attendance.model.Role;
import com.attendance.repository.AttendanceRepository;
import com.attendance.repository.AttendanceSessionRepository;
import com.attendance.repository.ClassRoomRepository;
import com.attendance.repository.StudentRepository;
import com.attendance.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final AttendanceRepository attendanceRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final StudentRepository studentRepository;
    private final ClassRoomRepository classRoomRepository;
    private final UserRepository userRepository;

    public AnalyticsService(AttendanceRepository attendanceRepository,
                            AttendanceSessionRepository sessionRepository,
                            StudentRepository studentRepository,
                            ClassRoomRepository classRoomRepository,
                            UserRepository userRepository) {
        this.attendanceRepository = attendanceRepository;
        this.sessionRepository = sessionRepository;
        this.studentRepository = studentRepository;
        this.classRoomRepository = classRoomRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse buildForAdmin(int days) {
        Instant from = Instant.now().minusSeconds((long) days * 86400);
        List<Attendance> records = attendanceRepository.findAllSince(from);
        List<AttendanceSession> sessions = sessionRepository.findEndedSince(from);

        long totalStudents = studentRepository.count();
        long totalClasses = classRoomRepository.count();
        long totalTeachers = userRepository.findAllByRole(Role.TEACHER).size();

        return build(records, sessions, totalStudents, totalClasses, totalTeachers, days);
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse buildForTeacher(Long teacherId, int days) {
        Instant from = Instant.now().minusSeconds((long) days * 86400);
        List<Attendance> records = attendanceRepository.findAllSinceForTeacher(from, teacherId);
        List<AttendanceSession> sessions = sessionRepository.findEndedSinceForTeacher(from, teacherId);

        // Count only students in teacher's classes
        long totalStudents = classRoomRepository.findByTeacherId(teacherId).stream()
                .mapToLong(c -> studentRepository.countByClassRoomId(c.getId()))
                .sum();
        long totalClasses = classRoomRepository.findByTeacherId(teacherId).size();

        return build(records, sessions, totalStudents, totalClasses, 0L, days);
    }

    private AnalyticsResponse build(List<Attendance> records,
                                    List<AttendanceSession> sessions,
                                    long totalStudents, long totalClasses, long totalTeachers,
                                    int days) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM dd").withZone(ZoneOffset.UTC);
        DateTimeFormatter dayKey = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);

        // ── Today's attendance ────────────────────────────────────────────────
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant todayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        List<Attendance> todayRecords = records.stream()
                .filter(a -> !a.getSession().getStartedAt().isBefore(todayStart))
                .toList();
        long todayPresent = todayRecords.stream().filter(a -> a.getStatus() == AttendanceStatus.PRESENT).count();
        long todayTotal = todayRecords.size();
        double todayPct = todayTotal > 0 ? (todayPresent * 100.0 / todayTotal) : 0;

        // ── Overall present / absent ──────────────────────────────────────────
        long overallPresent = records.stream().filter(a -> a.getStatus() == AttendanceStatus.PRESENT).count();
        long overallAbsent = records.stream().filter(a -> a.getStatus() == AttendanceStatus.ABSENT).count();

        // ── Daily trend ───────────────────────────────────────────────────────
        Map<String, long[]> dailyMap = new LinkedHashMap<>();
        // Pre-fill all days in range
        for (int i = days - 1; i >= 0; i--) {
            String k = dayKey.format(Instant.now().minusSeconds((long) i * 86400));
            dailyMap.put(k, new long[]{0, 0}); // [present, total]
        }
        for (Attendance a : records) {
            String k = dayKey.format(a.getSession().getStartedAt());
            dailyMap.computeIfAbsent(k, x -> new long[]{0, 0});
            dailyMap.get(k)[1]++;
            if (a.getStatus() == AttendanceStatus.PRESENT) dailyMap.get(k)[0]++;
        }
        List<DailyTrend> trend = dailyMap.entrySet().stream()
                .map(e -> {
                    long p = e.getValue()[0], t = e.getValue()[1];
                    double pct = t > 0 ? (p * 100.0 / t) : 0;
                    String label = fmt.format(Instant.parse(e.getKey() + "T00:00:00Z"));
                    return new DailyTrend(label, p, t, Math.round(pct * 10.0) / 10.0);
                })
                .toList();

        // ── Class-wise attendance ─────────────────────────────────────────────
        Map<String, long[]> classMap = new LinkedHashMap<>();
        for (Attendance a : records) {
            String cn = a.getStudent().getClassRoom().getName();
            classMap.computeIfAbsent(cn, x -> new long[]{0, 0});
            classMap.get(cn)[1]++;
            if (a.getStatus() == AttendanceStatus.PRESENT) classMap.get(cn)[0]++;
        }
        List<ClassAttendance> classAttendance = classMap.entrySet().stream()
                .map(e -> {
                    long p = e.getValue()[0], t = e.getValue()[1];
                    double pct = t > 0 ? Math.round(p * 1000.0 / t) / 10.0 : 0;
                    return new ClassAttendance(e.getKey(), pct, p, t);
                })
                .sorted(Comparator.comparing(ClassAttendance::className))
                .toList();

        // ── Per-student attendance % → distribution ───────────────────────────
        Map<Long, long[]> studentMap = new HashMap<>();
        for (Attendance a : records) {
            Long sid = a.getStudent().getId();
            studentMap.computeIfAbsent(sid, x -> new long[]{0, 0});
            studentMap.get(sid)[1]++;
            if (a.getStatus() == AttendanceStatus.PRESENT) studentMap.get(sid)[0]++;
        }
        long above90 = 0, between75 = 0, below75 = 0;
        for (long[] v : studentMap.values()) {
            double pct = v[1] > 0 ? v[0] * 100.0 / v[1] : 0;
            if (pct >= 90) above90++;
            else if (pct >= 75) between75++;
            else below75++;
        }

        // ── Low attendance students ───────────────────────────────────────────
        Map<Long, String[]> studentMeta = new HashMap<>(); // id -> [name, roll, className]
        for (Attendance a : records) {
            studentMeta.put(a.getStudent().getId(), new String[]{
                    a.getStudent().getName(),
                    a.getStudent().getRollNumber(),
                    a.getStudent().getClassRoom().getName()
            });
        }
        List<LowAttendanceStudent> lowStudents = studentMap.entrySet().stream()
                .filter(e -> {
                    long[] v = e.getValue();
                    return v[1] > 0 && (v[0] * 100.0 / v[1]) < 75;
                })
                .map(e -> {
                    long[] v = e.getValue();
                    double pct = Math.round(v[0] * 1000.0 / v[1]) / 10.0;
                    String[] meta = studentMeta.getOrDefault(e.getKey(), new String[]{"Unknown", "—", "—"});
                    return new LowAttendanceStudent(e.getKey(), meta[0], meta[1], meta[2], pct);
                })
                .sorted(Comparator.comparingDouble(LowAttendanceStudent::pct))
                .toList();

        // ── Recent sessions ───────────────────────────────────────────────────
        List<RecentSession> recentSessions = sessions.stream()
                .limit(10)
                .map(s -> {
                    long sp = attendanceRepository.countBySessionIdAndStatus(s.getId(), AttendanceStatus.PRESENT);
                    long sa = attendanceRepository.countBySessionIdAndStatus(s.getId(), AttendanceStatus.ABSENT);
                    long st = sp + sa;
                    double pct = st > 0 ? Math.round(sp * 1000.0 / st) / 10.0 : 0;
                    String dateStr = fmt.format(s.getStartedAt());
                    return new RecentSession(dateStr, s.getClassRoom().getName(), sp, sa, pct);
                })
                .toList();

        return new AnalyticsResponse(
                totalStudents, totalClasses, totalTeachers, Math.round(todayPct * 10.0) / 10.0,
                trend, overallPresent, overallAbsent,
                classAttendance, above90, between75, below75,
                lowStudents, recentSessions);
    }
}
