package com.attendance.controller;

import com.attendance.dto.StudentRequest;
import com.attendance.dto.StudentResponse;
import com.attendance.exception.NotFoundException;
import com.attendance.model.Student;
import com.attendance.service.StorageService;
import com.attendance.service.StudentService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;
    private final StorageService storageService;

    public StudentController(StudentService studentService, StorageService storageService) {
        this.studentService = studentService;
        this.storageService = storageService;
    }

    /**
     * Registers a student with one or more face photos. The photos are validated,
     * stored and embedded; registration fails if no usable face is found.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<StudentResponse> register(
            @RequestParam("name") @NotBlank(message = "Name is required") String name,
            @RequestParam("rollNumber") @NotBlank(message = "Roll number is required") String rollNumber,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam("classId") @NotNull(message = "Class id is required") Long classId,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {

        StudentRequest request = new StudentRequest();
        request.setName(name);
        request.setRollNumber(rollNumber);
        request.setEmail(email);
        request.setClassId(classId);

        return ResponseEntity.status(HttpStatus.CREATED).body(studentService.register(request, files));
    }

    @GetMapping
    public ResponseEntity<List<StudentResponse>> list(@RequestParam(value = "classId", required = false) Long classId) {
        return ResponseEntity.ok(studentService.listByClass(classId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(studentService.get(id));
    }

    @GetMapping("/{id}/photos/{fileName}")
    public ResponseEntity<Resource> photo(@PathVariable Long id, @PathVariable String fileName) {
        Student student = studentService.getEntity(id);
        String storedPath = student.getPhotoPaths().stream()
                .filter(path -> path.endsWith("/" + fileName))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Photo not found"));
        Resource resource = storageService.load(storedPath);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .body(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        studentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
