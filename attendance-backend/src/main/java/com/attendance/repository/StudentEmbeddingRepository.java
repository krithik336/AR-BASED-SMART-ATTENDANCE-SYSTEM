package com.attendance.repository;

import com.attendance.model.StudentEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentEmbeddingRepository extends JpaRepository<StudentEmbedding, Long> {

    @Query("""
            select e from StudentEmbedding e
            join fetch e.student s
            where s.classRoom.id = :classRoomId
              and s.active = true
              and s.faceRegistered = true
            """)
    List<StudentEmbedding> findEnrolledByClassRoomId(@Param("classRoomId") Long classRoomId);

    void deleteByStudentId(Long studentId);
}
