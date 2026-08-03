package com.attendance.repository;

import com.attendance.model.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {
    boolean existsByRollNumber(String rollNumber);

    @Query("""
            select s from Student s
            join fetch s.classRoom
            where s.classRoom.id = :classRoomId
            order by s.rollNumber asc
            """)
    List<Student> findByClassRoomIdOrderByRollNumberAsc(@Param("classRoomId") Long classRoomId);

    @Query("""
            select s from Student s
            join fetch s.classRoom
            where s.classRoom.id = :classRoomId
              and s.active = true
            order by s.rollNumber asc
            """)
    List<Student> findByClassRoomIdAndActiveTrueOrderByRollNumberAsc(@Param("classRoomId") Long classRoomId);

    @Query("""
            select s from Student s
            join fetch s.classRoom
            order by s.rollNumber asc
            """)
    List<Student> findAllOrderByRollNumberAsc();

    Optional<Student> findByRollNumber(String rollNumber);

    long countByClassRoomId(Long classRoomId);

    long countByClassRoomIdAndActiveTrue(Long classRoomId);
}
