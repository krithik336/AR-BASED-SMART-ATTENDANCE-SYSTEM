package com.attendance.repository;

import com.attendance.model.AttendanceSession;
import com.attendance.model.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    List<AttendanceSession> findByTeacherIdOrderByStartedAtDesc(Long teacherId);

    List<AttendanceSession> findByStatusOrderByStartedAtDesc(SessionStatus status);

    List<AttendanceSession> findByClassRoomIdOrderByStartedAtDesc(Long classRoomId);

    @Query("""
        select s from AttendanceSession s
        join fetch s.classRoom
        where s.startedAt >= :from
          and s.status = 'ENDED'
        order by s.startedAt desc
    """)
    List<AttendanceSession> findEndedSince(@Param("from") Instant from);

    @Query("""
        select s from AttendanceSession s
        join fetch s.classRoom cr
        where s.startedAt >= :from
          and s.status = 'ENDED'
          and cr.teacher.id = :teacherId
        order by s.startedAt desc
    """)
    List<AttendanceSession> findEndedSinceForTeacher(@Param("from") Instant from, @Param("teacherId") Long teacherId);
}
