package com.attendance.service;

import com.attendance.dto.AttendanceScanRequest;
import com.attendance.dto.CaptureUploadResponse;
import com.attendance.dto.RecognizedFace;
import com.attendance.dto.ScanResponse;
import com.attendance.dto.vision.CandidateFace;
import com.attendance.dto.vision.DetectResult;
import com.attendance.dto.vision.FaceMatch;
import com.attendance.dto.vision.MatchResult;
import com.attendance.dto.vision.QualityVerdict;
import com.attendance.exception.InvalidFileException;
import com.attendance.exception.NotFoundException;
import com.attendance.model.Attendance;
import com.attendance.model.AttendanceCapture;
import com.attendance.model.AttendanceSession;
import com.attendance.model.AttendanceStatus;
import com.attendance.model.CaptureStatus;
import com.attendance.model.Student;
import com.attendance.model.SessionStatus;
import com.attendance.repository.AttendanceCaptureRepository;
import com.attendance.repository.AttendanceRepository;
import com.attendance.repository.AttendanceSessionRepository;
import com.attendance.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Attendance orchestration.
 *
 * Two flows are supported:
 *
 * 1. Legacy live-scan:
 *    One webcam frame at a time, matched against the gallery.
 *
 * 2. Capture-and-process:
 *    A high-resolution classroom photo is uploaded,
 *    matched against the enrolled student gallery,
 *    and attendance evidence is stored.
 */
@Service
public class AttendanceService {

    private static final Logger log =
            LoggerFactory.getLogger(AttendanceService.class);

    private static final String CAPTURE_DIR = "captures";

    private static final int MAX_PREVIEW_BYTES =
            8 * 1024 * 1024;

    private final AttendanceSessionRepository sessionRepository;
    private final AttendanceRepository attendanceRepository;
    private final AttendanceCaptureRepository captureRepository;
    private final StudentRepository studentRepository;
    private final StudentService studentService;
    private final FaceRecognitionClient faceRecognitionClient;
    private final StorageService storageService;

    private final double similarityThreshold;
    private final double marginThreshold;

    public AttendanceService(
            AttendanceSessionRepository sessionRepository,
            AttendanceRepository attendanceRepository,
            AttendanceCaptureRepository captureRepository,
            StudentRepository studentRepository,
            StudentService studentService,
            FaceRecognitionClient faceRecognitionClient,
            StorageService storageService,
            @Value("${app.recognition.threshold:0.6}")
            double similarityThreshold,
            @Value("${app.recognition.margin:0.15}")
            double marginThreshold) {

        this.sessionRepository = sessionRepository;
        this.attendanceRepository = attendanceRepository;
        this.captureRepository = captureRepository;
        this.studentRepository = studentRepository;
        this.studentService = studentService;
        this.faceRecognitionClient = faceRecognitionClient;
        this.storageService = storageService;
        this.similarityThreshold = similarityThreshold;
        this.marginThreshold = marginThreshold;
    }

    // ============================================================
    // LEGACY LIVE SCAN
    // ============================================================

    @Transactional
    public ScanResponse scan(
            AttendanceScanRequest request) {

        AttendanceSession session =
                sessionRepository.findById(
                        request.getSessionId()
                ).orElseThrow(
                        () -> new NotFoundException(
                                "Session not found with id "
                                        + request.getSessionId()
                        )
                );

        if (session.getStatus() != SessionStatus.ACTIVE) {
            throw new IllegalArgumentException(
                    "Session is not active"
            );
        }

        Long classRoomId =
                session.getClassRoom().getId();

        List<CandidateFace> gallery =
                studentService.buildGallery(classRoomId);

        if (gallery.isEmpty()) {
            throw new IllegalArgumentException(
                    "No enrolled students in this class yet"
            );
        }

        log.info(
                "LIVE SCAN gallery: {} candidates, studentIds={}",
                gallery.size(),
                gallery.stream()
                        .map(CandidateFace::studentId)
                        .toList()
        );

        byte[] frame =
                decodeFrame(
                        request.getImageBase64()
                );

        MatchResult match =
                faceRecognitionClient.match(
                        frame,
                        gallery,
                        similarityThreshold
                );

        log.info(
                "LIVE SCAN match result: faceCount={}, faces={}",
                match.faceCount(),
                match.faces()
        );

        List<RecognizedFace> results =
                new ArrayList<>(
                        match.faces().size()
                );

        int recognized = 0;

        for (FaceMatch face : match.faces()) {

            if (face.matched()
                    && face.best() != null) {

                Student student =
                        studentRepository
                                .findById(
                                        face.best().studentId()
                                )
                                .orElse(null);

                if (student == null
                        || !student.isActive()) {

                    results.add(
                            new RecognizedFace(
                                    null,
                                    null,
                                    null,
                                    face.best().score(),
                                    face.confidence(),
                                    false,
                                    false,
                                    face.bbox()
                            )
                    );

                    continue;
                }

                boolean marked =
                        markPresent(
                                session,
                                student,
                                face.best().score()
                        );

                recognized++;

                results.add(
                        new RecognizedFace(
                                student.getId(),
                                student.getName(),
                                student.getRollNumber(),
                                face.best().score(),
                                face.confidence(),
                                true,
                                marked,
                                face.bbox()
                        )
                );

            } else {

                results.add(
                        new RecognizedFace(
                                null,
                                null,
                                null,
                                0.0,
                                face.confidence(),
                                false,
                                false,
                                face.bbox()
                        )
                );
            }
        }

        log.info(
                "Session {} live scan: {} face(s), {} recognized, threshold={}",
                session.getId(),
                match.faceCount(),
                recognized,
                similarityThreshold
        );

        return new ScanResponse(
                session.getId(),
                match.faceCount(),
                recognized,
                match.faceCount() - recognized,
                Instant.now(),
                results
        );
    }

    // ============================================================
    // PREVIEW DETECTION
    // ============================================================

    /**
     * Preview detection only.
     *
     * Does NOT perform recognition.
     * It only:
     *
     * - detects faces
     * - checks quality
     * - returns bounding boxes
     */
    public DetectResult detect(
            byte[] imageBytes) {

        if (imageBytes == null
                || imageBytes.length == 0) {

            throw new InvalidFileException(
                    "Preview frame is empty"
            );
        }

        if (imageBytes.length
                > MAX_PREVIEW_BYTES) {

            throw new InvalidFileException(
                    "Preview frame exceeds the 8 MB limit"
            );
        }

        return faceRecognitionClient.detect(
                imageBytes
        );
    }

    // ============================================================
    // FINAL CLASSROOM CAPTURE
    // ============================================================

    /**
     * Processes one classroom photograph.
     *
     * Flow:
     *
     * 1. Store classroom image.
     * 2. Build student recognition gallery.
     * 3. Send classroom image + gallery to Vision Service.
     * 4. Vision Service detects and matches faces.
     * 5. Check face quality.
     * 6. Check best-vs-second-best margin.
     * 7. Update attendance.
     */
    @Transactional
    public CaptureUploadResponse processCapture(
            Long sessionId,
            MultipartFile file) {

        AttendanceSession session =
                sessionRepository.findById(sessionId)
                        .orElseThrow(
                                () -> new NotFoundException(
                                        "Session not found with id "
                                                + sessionId
                                )
                        );

        if (session.getStatus()
                != SessionStatus.ACTIVE) {

            throw new IllegalArgumentException(
                    "Session is not active"
            );
        }

        if (file == null || file.isEmpty()) {

            throw new InvalidFileException(
                    "Classroom image is empty"
            );
        }

        // --------------------------------------------------------
        // Store original classroom image
        // --------------------------------------------------------

        String storedPath =
                storageService.store(
                        file,
                        CAPTURE_DIR,
                        sessionId.toString()
                );

        AttendanceCapture capture =
                captureRepository.save(
                        AttendanceCapture.builder()
                                .session(session)
                                .imagePath(storedPath)
                                .build()
                );

        try {

            capture.setStatus(
                    CaptureStatus.PROCESSING
            );

            captureRepository.save(capture);

            // ----------------------------------------------------
            // BUILD RECOGNITION GALLERY
            // ----------------------------------------------------

            Long classRoomId =
                    session.getClassRoom().getId();

            List<CandidateFace> gallery =
                    studentService.buildGallery(
                            classRoomId
                    );

            if (gallery.isEmpty()) {

                throw new IllegalArgumentException(
                        "No enrolled students in this class yet"
                );
            }

            // IMPORTANT DEBUG LOG
            log.info(
                    "================================================"
            );

            log.info(
                    "RECOGNITION GALLERY"
            );

            log.info(
                    "Classroom ID      : {}",
                    classRoomId
            );

            log.info(
                    "Gallery size      : {}",
                    gallery.size()
            );

            log.info(
                    "Student IDs       : {}",
                    gallery.stream()
                            .map(CandidateFace::studentId)
                            .toList()
            );

            log.info(
                    "Similarity threshold : {}",
                    similarityThreshold
            );

            log.info(
                    "Margin threshold     : {}",
                    marginThreshold
            );

            log.info(
                    "================================================"
            );

            // ----------------------------------------------------
            // RUN FACE RECOGNITION
            // ----------------------------------------------------

            MatchResult match =
                    faceRecognitionClient.match(
                            file.getBytes(),
                            gallery,
                            similarityThreshold
                    );

            // IMPORTANT DEBUG LOG
            log.info(
                    "================================================"
            );

            log.info(
                    "VISION MATCH RESULT"
            );

            log.info(
                    "Face count : {}",
                    match.faceCount()
            );

            log.info(
                    "Faces      : {}",
                    match.faces()
            );

            log.info(
                    "================================================"
            );

            int recognized = 0;
            int needsReview = 0;
            int unknown = 0;
            int rejected = 0;

            // ----------------------------------------------------
            // PROCESS EACH DETECTED FACE
            // ----------------------------------------------------

            for (FaceMatch face :
                    match.faces()) {

                // ------------------------------------------------
                // DEBUG FACE INFORMATION
                // ------------------------------------------------

                log.info(
                        "------------------------------------------------"
                );

                log.info(
                        "Processing detected face"
                );

                log.info(
                        "Confidence : {}",
                        face.confidence()
                );

                log.info(
                        "Matched    : {}",
                        face.matched()
                );

                log.info(
                        "Best       : {}",
                        face.best()
                );

                log.info(
                        "Candidates : {}",
                        face.candidates()
                );

                log.info(
                        "Quality    : {}",
                        face.quality()
                );

                // ------------------------------------------------
                // QUALITY CHECK
                // ------------------------------------------------

                if (face.quality() != null
                        && face.quality().verdict()
                        == QualityVerdict.POOR) {

                    log.warn(
                            "FACE REJECTED: quality is POOR. Reasons={}",
                            face.quality().reasons()
                    );

                    rejected++;

                    continue;
                }

                // ------------------------------------------------
                // MATCH CHECK
                // ------------------------------------------------

                if (face.matched()
                        && face.best() != null) {

                    Long studentId =
                            face.best().studentId();

                    double best =
                            face.best().score();

                    double second =
                            face.candidates().size() > 1
                                    ? face.candidates()
                                            .get(1)
                                            .score()
                                    : 0.0;

                    double margin =
                            best - second;

                    log.info(
                            "MATCH DETAILS: studentId={}, best={}, second={}, margin={}, threshold={}, marginThreshold={}",
                            studentId,
                            best,
                            second,
                            margin,
                            similarityThreshold,
                            marginThreshold
                    );

                    Student student =
                            studentRepository
                                    .findById(studentId)
                                    .orElse(null);

                    if (student == null) {

                        log.warn(
                                "MATCH REJECTED: student {} does not exist",
                                studentId
                        );

                        unknown++;

                        continue;
                    }

                    if (!student.isActive()) {

                        log.warn(
                                "MATCH REJECTED: student {} is inactive",
                                studentId
                        );

                        unknown++;

                        continue;
                    }

                    // ------------------------------------------------
                    // MARGIN CHECK
                    // ------------------------------------------------

                    boolean strong =
                            best >= similarityThreshold;

                    if (strong) {

                        log.info(
                                "RECOGNIZED: studentId={}, name={}, score={}, margin={}",
                                student.getId(),
                                student.getName(),
                                best,
                                margin
                        );

                        upsertEvidence(
                                session,
                                student,
                                best,
                                margin,
                                capture.getId(),
                                AttendanceStatus.PRESENT
                        );

                        recognized++;

                    } else {

                        log.warn(
                                "NEEDS REVIEW: studentId={}, name={}, score={}, margin={}",
                                student.getId(),
                                student.getName(),
                                best,
                                margin
                        );

                        upsertEvidence(
                                session,
                                student,
                                best,
                                margin,
                                capture.getId(),
                                AttendanceStatus.REVIEW
                        );

                        needsReview++;
                    }

                } else {

                    log.warn(
                            "UNKNOWN FACE: no valid match. Candidates={}",
                            face.candidates()
                    );

                    unknown++;
                }
            }

            // ----------------------------------------------------
            // SAVE CAPTURE RESULT
            // ----------------------------------------------------

            capture.setFaceCount(
                    match.faceCount()
            );

            capture.setRecognized(
                    recognized
            );

            capture.setNeedsReview(
                    needsReview
            );

            capture.setUnknown(
                    unknown
            );

            capture.setRejected(
                    rejected
            );

            capture.setStatus(
                    CaptureStatus.PROCESSED
            );

            capture.setProcessedAt(
                    Instant.now()
            );

            captureRepository.save(capture);

            // ----------------------------------------------------
            // FINAL LOG
            // ----------------------------------------------------

            log.info(
                    "================================================"
            );

            log.info(
                    "CAPTURE PROCESSING COMPLETE"
            );

            log.info(
                    "Session       : {}",
                    sessionId
            );

            log.info(
                    "Capture       : {}",
                    capture.getId()
            );

            log.info(
                    "Faces         : {}",
                    match.faceCount()
            );

            log.info(
                    "Recognized    : {}",
                    recognized
            );

            log.info(
                    "Review        : {}",
                    needsReview
            );

            log.info(
                    "Unknown       : {}",
                    unknown
            );

            log.info(
                    "Rejected      : {}",
                    rejected
            );

            log.info(
                    "Threshold     : {}",
                    similarityThreshold
            );

            log.info(
                    "Margin        : {}",
                    marginThreshold
            );

            log.info(
                    "================================================"
            );

            return new CaptureUploadResponse(
                    sessionId,
                    capture.getId(),
                    match.faceCount(),
                    recognized,
                    needsReview,
                    unknown,
                    rejected,
                    CaptureStatus.PROCESSED,
                    null
            );

        } catch (IOException ex) {

            markCaptureFailed(
                    capture,
                    "Failed to read uploaded image"
            );

            throw new InvalidFileException(
                    "Failed to read the uploaded image",
                    ex
            );

        } catch (RuntimeException ex) {

            markCaptureFailed(
                    capture,
                    ex.getMessage()
            );

            throw ex;
        }
    }

    // ============================================================
    // CAPTURE FAILURE
    // ============================================================

    private void markCaptureFailed(
            AttendanceCapture capture,
            String error) {

        capture.setStatus(
                CaptureStatus.FAILED
        );

        capture.setError(
                error != null && error.length() > 1900
                        ? error.substring(0, 1900)
                        : error
        );

        capture.setProcessedAt(
                Instant.now()
        );

        captureRepository.save(capture);
    }

    // ============================================================
    // ATTENDANCE EVIDENCE
    // ============================================================

    /**
     * Merges capture evidence into the student's
     * session attendance record.
     */
    private void upsertEvidence(
            AttendanceSession session,
            Student student,
            double score,
            double margin,
            Long captureId,
            AttendanceStatus status) {

        Attendance record =
                attendanceRepository
                        .findBySessionIdAndStudentId(
                                session.getId(),
                                student.getId()
                        )
                        .orElse(null);

        // --------------------------------------------------------
        // CREATE NEW RECORD
        // --------------------------------------------------------

        if (record == null) {

            attendanceRepository.save(
                    Attendance.builder()
                            .session(session)
                            .student(student)
                            .status(status)
                            .similarity(score)
                            .margin(margin)
                            .captureId(captureId)
                            .build()
            );

            log.info(
                    "Attendance created: session={}, student={}, status={}, score={}, margin={}",
                    session.getId(),
                    student.getId(),
                    status,
                    score,
                    margin
            );

            return;
        }

        boolean changed = false;

        // --------------------------------------------------------
        // Keep highest similarity
        // --------------------------------------------------------

        if (score > record.getSimilarity()) {

            record.setSimilarity(score);
            record.setMargin(margin);
            record.setCaptureId(captureId);

            changed = true;
        }

        // --------------------------------------------------------
        // Evidence count
        // --------------------------------------------------------

        record.setEvidenceCount(
                record.getEvidenceCount() + 1
        );

        changed = true;

        // --------------------------------------------------------
        // Upgrade status
        // --------------------------------------------------------

        if (status == AttendanceStatus.PRESENT
                && record.getStatus()
                != AttendanceStatus.PRESENT) {

            record.setStatus(
                    AttendanceStatus.PRESENT
            );

            changed = true;

        } else if (
                status == AttendanceStatus.REVIEW
                        && record.getStatus()
                        != AttendanceStatus.PRESENT
                        && record.getStatus()
                        != AttendanceStatus.REVIEW) {

            record.setStatus(
                    AttendanceStatus.REVIEW
            );

            changed = true;
        }

        if (changed) {

            attendanceRepository.save(record);

            log.info(
                    "Attendance updated: session={}, student={}, status={}, score={}, margin={}, evidenceCount={}",
                    session.getId(),
                    student.getId(),
                    record.getStatus(),
                    record.getSimilarity(),
                    record.getMargin(),
                    record.getEvidenceCount()
            );
        }
    }

    // ============================================================
    // LEGACY PRESENT
    // ============================================================

    private boolean markPresent(
            AttendanceSession session,
            Student student,
            double score) {

        Attendance record =
                attendanceRepository
                        .findBySessionIdAndStudentId(
                                session.getId(),
                                student.getId()
                        )
                        .orElse(null);

        // --------------------------------------------------------
        // CREATE
        // --------------------------------------------------------

        if (record == null) {

            attendanceRepository.save(
                    Attendance.builder()
                            .session(session)
                            .student(student)
                            .status(AttendanceStatus.PRESENT)
                            .similarity(score)
                            .margin(0.0)
                            .build()
            );

            log.info(
                    "Legacy attendance created: session={}, student={}, score={}",
                    session.getId(),
                    student.getId(),
                    score
            );

            return true;
        }

        boolean changed = false;

        // --------------------------------------------------------
        // Upgrade status
        // --------------------------------------------------------

        if (record.getStatus()
                != AttendanceStatus.PRESENT) {

            record.setStatus(
                    AttendanceStatus.PRESENT
            );

            changed = true;
        }

        // --------------------------------------------------------
        // Keep best similarity
        // --------------------------------------------------------

        if (score > record.getSimilarity()) {

            record.setSimilarity(score);

            changed = true;
        }

        if (changed) {

            attendanceRepository.save(record);

            log.info(
                    "Legacy attendance updated: session={}, student={}, score={}",
                    session.getId(),
                    student.getId(),
                    record.getSimilarity()
            );
        }

        return changed;
    }

    // ============================================================
    // BASE64 DECODER
    // ============================================================

    private byte[] decodeFrame(
            String imageBase64) {

        try {

            return Base64.getDecoder()
                    .decode(imageBase64);

        } catch (IllegalArgumentException ex) {

            throw new InvalidFileException(
                    "Frame image is not valid base64"
            );
        }
    }
}