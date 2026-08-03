package com.attendance.service;

import com.attendance.dto.AttendanceRecordResponse;
import com.attendance.dto.SessionReportResponse;
import com.attendance.dto.SessionResponse;
import com.attendance.dto.SessionStartRequest;
import com.attendance.exception.NotFoundException;
import com.attendance.model.Attendance;
import com.attendance.model.AttendanceSession;
import com.attendance.model.AttendanceStatus;
import com.attendance.model.ClassRoom;
import com.attendance.model.Student;
import com.attendance.model.SessionStatus;
import com.attendance.repository.AttendanceRepository;
import com.attendance.repository.AttendanceSessionRepository;
import com.attendance.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AttendanceSessionService {

    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceRepository attendanceRepository;
    private final StudentRepository studentRepository;
    private final ClassRoomService classRoomService;

    public AttendanceSessionService(AttendanceSessionRepository sessionRepository,
                                    AttendanceRepository attendanceRepository,
                                    StudentRepository studentRepository,
                                    ClassRoomService classRoomService) {
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
        this.studentRepository = studentRepository;
        this.classRoomService = classRoomService;
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
     * record is marked ABSENT; any leftover UNVERIFIED record becomes ABSENT.
     */
    @Transactional
    public SessionResponse end(Long sessionId) {
        AttendanceSession session = getEntity(sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new IllegalArgumentException("Session has already been ended");
        }

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
                        .build());
            } else if (record.getStatus() != AttendanceStatus.PRESENT) {
                record.setStatus(AttendanceStatus.ABSENT);
                attendanceRepository.save(record);
            }
        }

        session.end();
        sessionRepository.save(session);
        return toResponse(session);
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

    private SessionResponse toResponse(AttendanceSession session) {
        Long sessionId = session.getId();
        Long classRoomId = session.getClassRoom().getId();

        long total = studentRepository.countByClassRoomIdAndActiveTrue(classRoomId);
        long present = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.PRESENT);
        long absent = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.ABSENT);
        long unverified = attendanceRepository.countBySessionIdAndStatus(sessionId, AttendanceStatus.UNVERIFIED);

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
                unverified);
    }
}
