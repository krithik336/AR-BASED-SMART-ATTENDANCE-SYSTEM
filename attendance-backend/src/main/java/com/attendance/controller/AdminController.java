package com.attendance.controller;

import com.attendance.dto.TeacherRequest;
import com.attendance.dto.TeacherResponse;
import com.attendance.exception.NotFoundException;
import com.attendance.model.Role;
import com.attendance.model.User;
import com.attendance.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/teachers")
public class AdminController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping
    public ResponseEntity<TeacherResponse> create(@Valid @RequestBody TeacherRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        User teacher = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.TEACHER)
                .build();
        User saved = userRepository.save(teacher);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @GetMapping
    public ResponseEntity<List<TeacherResponse>> list() {
        List<TeacherResponse> teachers = userRepository.findAllByRole(Role.TEACHER)
                .stream().map(this::toResponse).toList();
        return ResponseEntity.ok(teachers);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TeacherResponse> update(@PathVariable Long id,
                                                   @Valid @RequestBody TeacherRequest request) {
        User teacher = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Teacher not found with id " + id));
        if (teacher.getRole() != Role.TEACHER) {
            throw new IllegalArgumentException("User is not a teacher");
        }
        if (!teacher.getEmail().equalsIgnoreCase(request.getEmail())
                && userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("An account with this email already exists");
        }
        teacher.setName(request.getName());
        teacher.setEmail(request.getEmail());
        teacher.setPassword(passwordEncoder.encode(request.getPassword()));
        return ResponseEntity.ok(toResponse(userRepository.save(teacher)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        User teacher = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Teacher not found with id " + id));
        if (teacher.getRole() != Role.TEACHER) {
            throw new IllegalArgumentException("User is not a teacher");
        }
        userRepository.delete(teacher);
        return ResponseEntity.noContent().build();
    }

    private TeacherResponse toResponse(User user) {
        return new TeacherResponse(user.getId(), user.getName(), user.getEmail());
    }
}
