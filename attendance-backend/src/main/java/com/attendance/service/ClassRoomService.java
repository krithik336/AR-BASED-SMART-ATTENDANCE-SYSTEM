package com.attendance.service;

import com.attendance.dto.ClassRoomRequest;
import com.attendance.dto.ClassRoomResponse;
import com.attendance.exception.NotFoundException;
import com.attendance.model.ClassRoom;
import com.attendance.model.User;
import com.attendance.repository.AttendanceSessionRepository;
import com.attendance.repository.ClassRoomRepository;
import com.attendance.repository.StudentRepository;
import com.attendance.repository.UserRepository;
import com.attendance.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClassRoomService {

    private final ClassRoomRepository classRoomRepository;
    private final StudentRepository studentRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;

    public ClassRoomService(ClassRoomRepository classRoomRepository,
                            StudentRepository studentRepository,
                            AttendanceSessionRepository sessionRepository,
                            UserRepository userRepository,
                            CurrentUser currentUser) {
        this.classRoomRepository = classRoomRepository;
        this.studentRepository = studentRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.currentUser = currentUser;
    }

    @Transactional
    public ClassRoomResponse create(ClassRoomRequest request) {
        if (classRoomRepository.existsByNameIgnoreCase(request.getName().trim())) {
            throw new IllegalArgumentException("A class with this name already exists");
        }
        if (classRoomRepository.existsByCodeIgnoreCase(request.getCode().trim())) {
            throw new IllegalArgumentException("A class with this code already exists");
        }

        ClassRoom room = ClassRoom.builder()
                .name(request.getName().trim())
                .code(request.getCode().trim().toUpperCase())
                .description(request.getDescription())
                .build();

        return toResponse(classRoomRepository.save(room));
    }

    @Transactional(readOnly = true)
    public List<ClassRoomResponse> list() {
        return classRoomRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClassRoomResponse get(Long id) {
        return toResponse(getEntity(id));
    }

    @Transactional
    public ClassRoomResponse update(Long id, ClassRoomRequest request) {
        ClassRoom room = getEntity(id);
        if (!room.getName().equalsIgnoreCase(request.getName().trim())
                && classRoomRepository.existsByNameIgnoreCase(request.getName().trim())) {
            throw new IllegalArgumentException("A class with this name already exists");
        }
        if (!room.getCode().equalsIgnoreCase(request.getCode().trim())
                && classRoomRepository.existsByCodeIgnoreCase(request.getCode().trim())) {
            throw new IllegalArgumentException("A class with this code already exists");
        }
        room.setDescription(request.getDescription());
        return toResponse(classRoomRepository.save(room));
    }

    @Transactional
    public void delete(Long id) {
        ClassRoom room = getEntity(id);
        if (!sessionRepository.findByClassRoomIdOrderByStartedAtDesc(id).isEmpty()) {
            throw new IllegalArgumentException("Cannot delete a class that has attendance sessions");
        }
        classRoomRepository.delete(room);
    }

    @Transactional
    public ClassRoomResponse assignTeacher(Long classId, Long teacherId) {
        ClassRoom room = getEntity(classId);
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new NotFoundException("Teacher not found with id " + teacherId));
        room.setTeacher(teacher);
        return toResponse(classRoomRepository.save(room));
    }

    @Transactional(readOnly = true)
    public List<ClassRoomResponse> myClasses() {
        return classRoomRepository.findByTeacherId(currentUser.id()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClassRoom getEntity(Long id) {
        return classRoomRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class not found with id " + id));
    }

    private ClassRoomResponse toResponse(ClassRoom room) {
        long studentCount = studentRepository.countByClassRoomId(room.getId());
        User teacher = room.getTeacher();
        return new ClassRoomResponse(
                room.getId(),
                room.getName(),
                room.getCode(),
                room.getDescription(),
                studentCount,
                room.getCreatedAt(),
                teacher != null ? teacher.getId() : null,
                teacher != null ? teacher.getName() : null);
    }
}
