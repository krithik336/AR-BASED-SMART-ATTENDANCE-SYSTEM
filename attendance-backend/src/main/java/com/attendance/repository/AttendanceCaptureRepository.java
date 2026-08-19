package com.attendance.repository;

import com.attendance.model.AttendanceCapture;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttendanceCaptureRepository extends JpaRepository<AttendanceCapture, Long> {

    List<AttendanceCapture> findBySessionIdOrderByUploadedAtAsc(Long sessionId);

    long countBySessionId(Long sessionId);
}
