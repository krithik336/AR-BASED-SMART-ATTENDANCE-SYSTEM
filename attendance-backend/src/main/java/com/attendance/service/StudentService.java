package com.attendance.service;

import com.attendance.dto.StudentRequest;
import com.attendance.dto.StudentResponse;
import com.attendance.dto.vision.CandidateFace;
import com.attendance.dto.vision.EmbedResult;
import com.attendance.exception.InvalidFileException;
import com.attendance.exception.NotFoundException;
import com.attendance.model.ClassRoom;
import com.attendance.model.Student;
import com.attendance.model.StudentEmbedding;
import com.attendance.repository.ClassRoomRepository;
import com.attendance.repository.StudentEmbeddingRepository;
import com.attendance.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Student lifecycle: registration (multi-photo upload + embedding generation),
 * listing, gallery building for recognition, and deletion.
 */
@Service
public class StudentService {

    private static final Logger log = LoggerFactory.getLogger(StudentService.class);
    private static final int MAX_PHOTOS = 10;
    private static final String PHOTO_DIR = "students";

    private final StudentRepository studentRepository;
    private final StudentEmbeddingRepository embeddingRepository;
    private final ClassRoomRepository classRoomRepository;
    private final StorageService storageService;
    private final FaceRecognitionClient faceRecognitionClient;
    private final int embeddingSize;

    public StudentService(StudentRepository studentRepository,
                          StudentEmbeddingRepository embeddingRepository,
                          ClassRoomRepository classRoomRepository,
                          StorageService storageService,
                          FaceRecognitionClient faceRecognitionClient,
                          @Value("${app.recognition.embedding-size:512}") int embeddingSize) {
        this.studentRepository = studentRepository;
        this.embeddingRepository = embeddingRepository;
        this.classRoomRepository = classRoomRepository;
        this.storageService = storageService;
        this.faceRecognitionClient = faceRecognitionClient;
        this.embeddingSize = embeddingSize;
    }

    /**
     * Registers a student with several photos: persists them, asks the vision
     * service to embed each one, and stores every valid 512-d embedding.
     * Registration fails (with cleanup) if no photo yields a usable face.
     */
    @Transactional
    public StudentResponse register(StudentRequest request, List<MultipartFile> files) {
        String rollNumber = request.getRollNumber().trim();
        if (studentRepository.existsByRollNumber(rollNumber)) {
            throw new IllegalArgumentException("A student with roll number " + rollNumber + " already exists");
        }
        if (files == null || files.isEmpty()) {
            throw new InvalidFileException("At least one photo is required");
        }
        if (files.size() > MAX_PHOTOS) {
            throw new IllegalArgumentException("At most " + MAX_PHOTOS + " photos can be uploaded");
        }

        ClassRoom classRoom = classRoomRepository.findById(request.getClassId())
                .orElseThrow(() -> new NotFoundException("Class not found with id " + request.getClassId()));

        List<String> storedPaths = new ArrayList<>();
        try {
            Student student = Student.builder()
                    .name(request.getName().trim())
                    .rollNumber(rollNumber)
                    .email(request.getEmail())
                    .classRoom(classRoom)
                    .build();
            student = studentRepository.save(student);

            for (MultipartFile file : files) {
                String path = storageService.store(file, PHOTO_DIR, student.getId().toString());
                storedPaths.add(path);
                student.addPhotoPath(path);
            }
            studentRepository.save(student);

            List<EmbedResult> results = faceRecognitionClient.embedBatch(files);
            int saved = linkEmbeddings(student, results, storedPaths);
            if (saved == 0) {
                throw new InvalidFileException("No usable face was detected in the uploaded photos");
            }
            log.info("Registered student '{}' (id={}) with {} embedding(s)", student.getName(), student.getId(), saved);

            student.setFaceRegistered(true);
            studentRepository.save(student);
            return toResponse(student);
        } catch (RuntimeException ex) {
            for (String path : storedPaths) {
                storageService.deleteQuietly(path);
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> listByClass(Long classId) {
        if (classId == null) {
            return studentRepository.findAllOrderByRollNumberAsc().stream()
                    .map(this::toResponse)
                    .toList();
        }
        return studentRepository.findByClassRoomIdOrderByRollNumberAsc(classId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StudentResponse get(Long id) {
        return toResponse(getEntity(id));
    }

    @Transactional(readOnly = true)
    public Student getEntity(Long id) {
        return studentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Student not found with id " + id));
    }

    @Transactional
    public void delete(Long id) {
        Student student = getEntity(id);
        for (String path : student.getPhotoPaths()) {
            storageService.deleteQuietly(path);
        }
        embeddingRepository.deleteByStudentId(id);
        studentRepository.delete(student);
    }

    /**
     * Builds the recognition gallery for a class: one centroid embedding per
     * enrolled student (mean of their registered embeddings, L2 re-normalised).
     */
    @Transactional(readOnly = true)
    public List<CandidateFace> buildGallery(Long classRoomId) {
        List<StudentEmbedding> embeddings = embeddingRepository.findEnrolledByClassRoomId(classRoomId);

        Map<Long, List<List<Double>>> byStudent = new HashMap<>();
        for (StudentEmbedding embedding : embeddings) {
            byStudent.computeIfAbsent(embedding.getStudent().getId(), k -> new ArrayList<>())
                    .add(embedding.getVector());
        }

        List<CandidateFace> gallery = new ArrayList<>(byStudent.size());
        byStudent.forEach((studentId, vectors) -> gallery.add(new CandidateFace(studentId, centroid(vectors))));
        return gallery;
    }

    private int linkEmbeddings(Student student, List<EmbedResult> results, List<String> storedPaths) {
        int saved = 0;
        for (int i = 0; i < results.size(); i++) {
            EmbedResult result = results.get(i);
            if (result != null && result.faceDetected()
                    && result.embedding() != null
                    && result.embedding().size() == embeddingSize) {
                String source = i < storedPaths.size() ? storedPaths.get(i) : null;
                student.addEmbedding(StudentEmbedding.builder()
                        .student(student)
                        .vector(result.embedding())
                        .source(source)
                        .build());
                saved++;
            }
        }
        return saved;
    }

    private List<Double> centroid(List<List<Double>> vectors) {
        double[] sum = new double[embeddingSize];
        for (List<Double> vector : vectors) {
            for (int i = 0; i < embeddingSize && i < vector.size(); i++) {
                sum[i] += vector.get(i);
            }
        }
        double norm = 0.0;
        for (double value : sum) {
            norm += value * value;
        }
        norm = Math.sqrt(norm);
        if (norm < 1e-12) {
            return vectors.get(0);
        }
        List<Double> centroid = new ArrayList<>(embeddingSize);
        for (double value : sum) {
            centroid.add(value / norm);
        }
        return centroid;
    }

    private StudentResponse toResponse(Student student) {
        return new StudentResponse(
                student.getId(),
                student.getName(),
                student.getRollNumber(),
                student.getEmail(),
                student.getClassRoom().getId(),
                student.getClassRoom().getName(),
                student.isFaceRegistered(),
                student.isActive(),
                student.getPhotoPaths().size(),
                student.getEmbeddings().size(),
                student.getCreatedAt());
    }
}
