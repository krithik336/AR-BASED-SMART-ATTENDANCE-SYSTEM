package com.attendance.repository;

import com.attendance.model.Attendance;
import com.attendance.model.AttendanceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    Optional<Attendance> findBySessionIdAndStudentId(Long sessionId, Long studentId);

    List<Attendance> findBySessionId(Long sessionId);

    long countBySessionIdAndStatus(Long sessionId, AttendanceStatus status);

    @Query("""
        select a from Attendance a
        join fetch a.session s
        join fetch a.student st
        join fetch st.classRoom
        where s.startedAt >= :from
    """)
    List<Attendance> findAllSince(@Param("from") Instant from);

    @Query("""
        select a from Attendance a
        join fetch a.session s
        join fetch a.student st
        join fetch st.classRoom
        where s.startedAt >= :from
          and st.classRoom.teacher.id = :teacherId
    """)
    List<Attendance> findAllSinceForTeacher(@Param("from") Instant from, @Param("teacherId") Long teacherId);
}
