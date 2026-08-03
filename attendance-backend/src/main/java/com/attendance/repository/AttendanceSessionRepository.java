package com.attendance.repository;

import com.attendance.model.AttendanceSession;
import com.attendance.model.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    List<AttendanceSession> findByTeacherIdOrderByStartedAtDesc(Long teacherId);

    List<AttendanceSession> findByStatusOrderByStartedAtDesc(SessionStatus status);

    List<AttendanceSession> findByClassRoomIdOrderByStartedAtDesc(Long classRoomId);
}
