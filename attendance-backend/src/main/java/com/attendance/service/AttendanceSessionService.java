package com.attendance.service;

import com.attendance.dto.AttendanceRecordResponse;
import com.attendance.dto.ReviewRecordResponse;
import com.attendance.dto.SessionReportResponse;
import com.attendance.dto.SessionResponse;
import com.attendance.dto.SessionReviewResponse;
import com.attendance.dto.SessionStartRequest;
import com.attendance.exception.NotFoundException;
import com.attendance.model.Attendance;
import com.attendance.model.AttendanceSession;
import com.attendance.model.AttendanceStatus;
import com.attendance.model.ClassRoom;
import com.attendance.model.Student;
import com.attendance.model.SessionStatus;
import com.attendance.repository.AttendanceCaptureRepository;
import com.attendance.repository.AttendanceRepository;
import com.attendance.repository.AttendanceSessionRepository;
import com.attendance.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class AttendanceSessionService {

    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceRepository attendanceRepository;
    private final StudentRepository studentRepository;
    private final ClassRoomService classRoomService;
    private final AttendanceCaptureRepository captureRepository;

    public AttendanceSessionService(AttendanceSessionRepository sessionRepository,
                                    AttendanceRepository attendanceRepository,
                                    StudentRepository studentRepository,
                                    ClassRoomService classRoomService,
                                    AttendanceCaptureRepository captureRepository) {
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
        this.studentRepository = studentRepository;
        this.classRoomService = classRoomService;
        this.captureRepository = captureRepository;
    }

    @Transactional
    public SessionResponse start(Long teacherId, SessionStartRequest request) {
        ClassRoom classRoom = classRoomService.getEntity(request.getClassId());

        AttendanceSession session = AttendanceSession.builder()
                .classRoom(classRoom)
                .teacherId(teacherId)
                .subject(request.getSubject())
                .build();

        return toResponse(sessionRepository.save(session));
    }

    /**
     * Ends a session and finalises attendance: every student without a PRESENT
     * record is marked ABSENT; any leftover REVIEW/UNVERIFIED record becomes ABSENT.
     * Kept for backward compatibility with the old live-scan flow.
     */
    @Transactional
    public SessionResponse end(Long sessionId) {
        AttendanceSession session = getEntity(sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new IllegalArgumentException("Session has already been ended");
        }
        if (session.getStatus() == SessionStatus.CANCELLED) {
            throw new IllegalArgumentException("Session has already been cancelled");
        }
        finalizeSession(session);
        return toResponse(session);
    }

    /**
     * Finalise attendance after teacher review. Everyone who is not PRESENT
     * becomes ABSENT; REVIEW rows the teacher did not override default to ABSENT.
     */
    @Transactional
    public SessionResponse submit(Long sessionId) {
        AttendanceSession session = getEntity(sessionId);
        if (session.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalArgumentException("Only active sessions can be submitted");
        }
        finalizeSession(session);
        return toResponse(session);
    }

    /**
     * Abandon a session without producing a final attendance. Captured photos
     * and interim records are kept for audit but the session no longer counts.
     */
    @Transactional
    public SessionResponse cancel(Long sessionId) {
        AttendanceSession session = getEntity(sessionId);
        if (session.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalArgumentException("Only active sessions can be cancelled");
        }
        session.cancel();
        return toResponse(sessionRepository.save(session));
    }

    /**
     * Teacher decision on a reviewed student. Only PRESENT / ABSENT are allowed;
     * other values are rejected.
     */
    @Transactional
    public ReviewRecordResponse overrideStatus(Long sessionId, Long studentId, AttendanceStatus status) {
        if (status != AttendanceStatus.PRESENT && status != AttendanceStatus.ABSENT) {
            throw new IllegalArgumentException("Review override must be PRESENT or ABSENT");
        }
        AttendanceSession session = getEntity(sessionId);
        if (session.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalArgumentException("Session is not active");
        }
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NotFoundException("Student not found with id " + studentId));

        Attendance record = attendanceRepository
                .findBySessionIdAndStudentId(sessionId, studentId)
                .orElseGet(() -> Attendance.builder()
                        .session(session)
                        .student(student)
                        .status(status)
                        .similarity(0.0)
                        .margin(0.0)
                        .build());
        record.setStatus(status);
        return toReviewRecord(attendanceRepository.save(record));
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> listForTeacher(Long teacherId) {
        return sessionRepository.findByTeacherIdOrderByStartedAtDesc(teacherId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SessionResponse get(Long sessionId) {
        return toResponse(getEntity(sessionId));
    }

    @Transactional(readOnly = true)
    public AttendanceSession getEntity(Long sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found with id " + sessionId));
    }

    /**
     * Full review state: every enrolled student with its current status, plus
     * summary counters for the teacher review screen.
     */
    @Transactional(readOnly = true)
    public SessionReviewResponse review(Long sessionId) {
        AttendanceSession session = getEntity(sessionId);
        Long classRoomId = session.getClassRoom().getId();

        List<Student> students = studentRepository.findByClassRoomIdAndActiveTrueOrderByRollNumberAsc(classRoomId);
        List<Attendance> records = attendanceRepository.findBySessionId(sessionId);

        java.util.Map<Long, Attendance> byStudent = new java.util.HashMap<>();
        for (Attendance record : records) {
            byStudent.put(record.getStudent().getId(), record);
        }

        List<ReviewRecordResponse> rows = new ArrayList<>(students.size());
        for (Student student : students) {
            Attendance record = byStudent.get(student.getId());
            if (record == null) {
                rows.add(new ReviewRecordResponse(
                        student.getId(), student.getName(), student.getRollNumber(),
                        AttendanceStatus.UNVERIFIED, 0.0, 0.0, 0, null, null));
            } else {
                rows.add(toReviewRecord(record));
            }
        }
        rows.sort((a, b) -> a.rollNumber().compareToIgnoreCase(b.rollNumber()));

        long present = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.PRESENT);
        long review = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.REVIEW);

        return new SessionReviewResponse(
                toResponse(session),
                students.size(),
                present,
                review,
                students.size() - present - review,
                captureRepository.countBySessionId(sessionId),
                rows);
    }

    @Transactional(readOnly = true)
    public SessionReportResponse report(Long sessionId) {
        AttendanceSession session = getEntity(sessionId);
        List<AttendanceRecordResponse> records = attendanceRepository.findBySessionId(sessionId).stream()
                .sorted((a, b) -> a.getStudent().getName().compareToIgnoreCase(b.getStudent().getName()))
                .map(record -> new AttendanceRecordResponse(
                        record.getStudent().getId(),
                        record.getStudent().getName(),
                        record.getStudent().getRollNumber(),
                        record.getStatus(),
                        record.getSimilarity(),
                        record.getMarkedAt()))
                .toList();
        return new SessionReportResponse(toResponse(session), records);
    }

    /**
     * Marks everyone who is not PRESENT as ABSENT and ends the session.
     */
    private void finalizeSession(AttendanceSession session) {
        Long sessionId = session.getId();
        Long classRoomId = session.getClassRoom().getId();
        for (Student student : studentRepository.findByClassRoomIdAndActiveTrueOrderByRollNumberAsc(classRoomId)) {
            Attendance record = attendanceRepository
                    .findBySessionIdAndStudentId(sessionId, student.getId())
                    .orElse(null);
            if (record == null) {
                attendanceRepository.save(Attendance.builder()
                        .session(session)
                        .student(student)
                        .status(AttendanceStatus.ABSENT)
                        .similarity(0.0)
                        .margin(0.0)
                        .build());
            } else if (record.getStatus() != AttendanceStatus.PRESENT) {
                record.setStatus(AttendanceStatus.ABSENT);
                attendanceRepository.save(record);
            }
        }

        session.end();
        sessionRepository.save(session);
    }

    private ReviewRecordResponse toReviewRecord(Attendance record) {
        return new ReviewRecordResponse(
                record.getStudent().getId(),
                record.getStudent().getName(),
                record.getStudent().getRollNumber(),
                record.getStatus(),
                record.getSimilarity(),
                record.getMargin(),
                record.getEvidenceCount(),
                record.getCaptureId(),
                record.getMarkedAt());
    }

    private SessionResponse toResponse(AttendanceSession session) {
        Long sessionId = session.getId();
        Long classRoomId = session.getClassRoom().getId();

        long total = studentRepository.countByClassRoomIdAndActiveTrue(classRoomId);
        long present = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.PRESENT);
        long absent = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.ABSENT);
        long unverified = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.UNVERIFIED);
        long review = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.REVIEW);
        long photos = captureRepository.countBySessionId(sessionId);

        return new SessionResponse(
                sessionId,
                classRoomId,
                session.getClassRoom().getName(),
                session.getTeacherId(),
                session.getSubject(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getStatus(),
                total,
                present,
                absent,
                unverified,
                review,
                photos);
    }
}
