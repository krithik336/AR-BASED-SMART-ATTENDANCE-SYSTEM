package com.attendance.controller;

import com.attendance.dto.ClassRoomRequest;
import com.attendance.dto.ClassRoomResponse;
import com.attendance.service.ClassRoomService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
public class ClassRoomController {

    private final ClassRoomService classRoomService;

    public ClassRoomController(ClassRoomService classRoomService) {
        this.classRoomService = classRoomService;
    }

    @PostMapping
    public ResponseEntity<ClassRoomResponse> create(@Valid @RequestBody ClassRoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(classRoomService.create(request));
    }

    @GetMapping
    public ResponseEntity<List<ClassRoomResponse>> list() {
        return ResponseEntity.ok(classRoomService.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassRoomResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(classRoomService.get(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClassRoomResponse> update(@PathVariable Long id,
                                                    @Valid @RequestBody ClassRoomRequest request) {
        return ResponseEntity.ok(classRoomService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        classRoomService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
