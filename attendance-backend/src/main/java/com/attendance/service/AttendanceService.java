package com.attendance.service;

import com.attendance.dto.AttendanceScanRequest;
import com.attendance.dto.RecognizedFace;
import com.attendance.dto.ScanResponse;
import com.attendance.dto.vision.CandidateFace;
import com.attendance.dto.vision.FaceMatch;
import com.attendance.dto.vision.MatchResult;
import com.attendance.exception.InvalidFileException;
import com.attendance.exception.NotFoundException;
import com.attendance.model.Attendance;
import com.attendance.model.AttendanceSession;
import com.attendance.model.AttendanceStatus;
import com.attendance.model.Student;
import com.attendance.model.SessionStatus;
import com.attendance.repository.AttendanceRepository;
import com.attendance.repository.StudentRepository;
import com.attendance.repository.AttendanceSessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Frame-level attendance: a webcam frame is matched against the active
 * session's class gallery; recognised students get an upserted PRESENT record.
 * Unknown faces are reported but never stored.
 */
@Service
public class AttendanceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceRepository attendanceRepository;
    private final StudentRepository studentRepository;
    private final StudentService studentService;
    private final FaceRecognitionClient faceRecognitionClient;
    private final double similarityThreshold;

    public AttendanceService(AttendanceSessionRepository sessionRepository,
                             AttendanceRepository attendanceRepository,
                             StudentRepository studentRepository,
                             StudentService studentService,
                             FaceRecognitionClient faceRecognitionClient,
                             @Value("${app.recognition.threshold:0.6}") double similarityThreshold) {
        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
        this.studentRepository = studentRepository;
        this.studentService = studentService;
        this.faceRecognitionClient = faceRecognitionClient;
        this.similarityThreshold = similarityThreshold;
    }

    @Transactional
    public ScanResponse scan(AttendanceScanRequest request) {
        AttendanceSession session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new NotFoundException("Session not found with id " + request.getSessionId()));
        if (session.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalArgumentException("Session is not active");
        }

        Long classRoomId = session.getClassRoom().getId();
        List<CandidateFace> gallery = studentService.buildGallery(classRoomId);
        if (gallery.isEmpty()) {
            throw new IllegalArgumentException("No enrolled students in this class yet");
        }

        byte[] frame = decodeFrame(request.getImageBase64());
        MatchResult match = faceRecognitionClient.match(frame, gallery, similarityThreshold);

        List<RecognizedFace> results = new ArrayList<>(match.faces().size());
        int recognized = 0;
        for (FaceMatch face : match.faces()) {
            if (face.matched() && face.best() != null) {
                Student student = studentRepository.findById(face.best().studentId()).orElse(null);
                if (student == null || !student.isActive()) {
                    results.add(new RecognizedFace(null, null, null,
                            face.best().score(), face.confidence(), false, false, face.bbox()));
                    continue;
                }
                boolean marked = markPresent(session, student, face.best().score());
                recognized++;
                results.add(new RecognizedFace(
                        student.getId(),
                        student.getName(),
                        student.getRollNumber(),
                        face.best().score(),
                        face.confidence(),
                        true,
                        marked,
                        face.bbox()));
            } else {
                results.add(new RecognizedFace(
                        null, null, null, 0.0, face.confidence(), false, false, face.bbox()));
            }
        }

        log.info("Session {} scan: {} face(s), {} recognized, threshold={}",
                session.getId(), match.faceCount(), recognized, similarityThreshold);

        return new ScanResponse(
                session.getId(),
                match.faceCount(),
                recognized,
                match.faceCount() - recognized,
                Instant.now(),
                results);
    }

    /**
     * Upserts a PRESENT record: creates it if missing, otherwise upgrades an
     * UNVERIFIED record or keeps the highest similarity seen. Returns true only
     * when this frame produced a state change (newly marked).
     */
    private boolean markPresent(AttendanceSession session, Student student, double score) {
        Attendance record = attendanceRepository
                .findBySessionIdAndStudentId(session.getId(), student.getId())
                .orElse(null);

        if (record == null) {
            attendanceRepository.save(Attendance.builder()
                    .session(session)
                    .student(student)
                    .status(AttendanceStatus.PRESENT)
                    .similarity(score)
                    .build());
            return true;
        }

        boolean changed = false;
        if (record.getStatus() != AttendanceStatus.PRESENT) {
            record.setStatus(AttendanceStatus.PRESENT);
            changed = true;
        }
        if (score > record.getSimilarity()) {
            record.setSimilarity(score);
            changed = true;
        }
        if (changed) {
            attendanceRepository.save(record);
        }
        return changed;
    }

    private byte[] decodeFrame(String imageBase64) {
        try {
            return Base64.getDecoder().decode(imageBase64);
        } catch (IllegalArgumentException ex) {
            throw new InvalidFileException("Frame image is not valid base64");
        }
    }
}
