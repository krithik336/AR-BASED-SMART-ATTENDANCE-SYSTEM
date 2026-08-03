package com.attendance.repository;

import com.attendance.model.Attendance;
import com.attendance.model.AttendanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    Optional<Attendance> findBySessionIdAndStudentId(Long sessionId, Long studentId);

    List<Attendance> findBySessionId(Long sessionId);

    long countBySessionIdAndStatus(Long sessionId, AttendanceStatus status);
}
