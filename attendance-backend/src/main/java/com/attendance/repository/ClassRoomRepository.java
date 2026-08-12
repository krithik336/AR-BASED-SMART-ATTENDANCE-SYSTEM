package com.attendance.repository;

import com.attendance.model.ClassRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassRoomRepository extends JpaRepository<ClassRoom, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByCodeIgnoreCase(String code);
    Optional<ClassRoom> findByCode(String code);
    List<ClassRoom> findByTeacherId(Long teacherId);
}
