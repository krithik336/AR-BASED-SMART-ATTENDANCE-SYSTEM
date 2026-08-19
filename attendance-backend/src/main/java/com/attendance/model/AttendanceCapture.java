package com.attendance.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * One high-resolution classroom photo uploaded for an attendance session.
 * The original image is preserved on disk; this row tracks where it lives and
 * what the vision service reported for it.
 */
@Entity
@Table(name = "attendance_captures")
public class AttendanceCapture {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private AttendanceSession session;

    /** Relative path of the stored original classroom image. */
    @Column(nullable = false, length = 1000)
    private String imagePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CaptureStatus status = CaptureStatus.PENDING;

    private Integer faceCount;
    private Integer recognized;
    private Integer needsReview;
    private Integer unknown;
    private Integer rejected;

    @Column(length = 2000)
    private String error;

    @Column(nullable = false, updatable = false)
    private Instant uploadedAt = Instant.now();

    private Instant processedAt;

    public AttendanceCapture() {}

    private AttendanceCapture(AttendanceSession session, String imagePath) {
        this.session = session;
        this.imagePath = imagePath;
    }

    public static AttendanceCaptureBuilder builder() { return new AttendanceCaptureBuilder(); }

    public static class AttendanceCaptureBuilder {
        private AttendanceSession session;
        private String imagePath;

        public AttendanceCaptureBuilder session(AttendanceSession session) { this.session = session; return this; }
        public AttendanceCaptureBuilder imagePath(String imagePath) { this.imagePath = imagePath; return this; }
        public AttendanceCapture build() { return new AttendanceCapture(session, imagePath); }
    }

    public Long getId() { return id; }
    public AttendanceSession getSession() { return session; }
    public String getImagePath() { return imagePath; }
    public CaptureStatus getStatus() { return status; }
    public Integer getFaceCount() { return faceCount; }
    public Integer getRecognized() { return recognized; }
    public Integer getNeedsReview() { return needsReview; }
    public Integer getUnknown() { return unknown; }
    public Integer getRejected() { return rejected; }
    public String getError() { return error; }
    public Instant getUploadedAt() { return uploadedAt; }
    public Instant getProcessedAt() { return processedAt; }

    public void setStatus(CaptureStatus status) { this.status = status; }
    public void setFaceCount(Integer faceCount) { this.faceCount = faceCount; }
    public void setRecognized(Integer recognized) { this.recognized = recognized; }
    public void setNeedsReview(Integer needsReview) { this.needsReview = needsReview; }
    public void setUnknown(Integer unknown) { this.unknown = unknown; }
    public void setRejected(Integer rejected) { this.rejected = rejected; }
    public void setError(String error) { this.error = error; }
    public void setProcessedAt(Instant processedAt) { this.processedAt = processedAt; }
}
