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
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(
        name = "attendance",
        uniqueConstraints = @UniqueConstraint(name = "uq_session_student", columnNames = {"session_id", "student_id"})
)
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private AttendanceSession session;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AttendanceStatus status = AttendanceStatus.UNVERIFIED;

    @Column(nullable = false)
    private double similarity;

    /** best_score - second_best_score for the strongest capture of this student. */
    @Column(nullable = false)
    private double margin;

    /** Number of classroom captures that recognised this student (evidence). */
    @Column(nullable = false)
    private int evidenceCount = 0;

    /** Capture id that produced the strongest match (nullable for manual overrides). */
    private Long captureId;

    @Column(nullable = false, updatable = false)
    private Instant markedAt = Instant.now();

    public Attendance() {}

    private Attendance(AttendanceSession session, Student student, AttendanceStatus status, double similarity,
                      double margin, Long captureId) {
        this.session = session;
        this.student = student;
        this.status = status;
        this.similarity = similarity;
        this.margin = margin;
        this.captureId = captureId;
        this.evidenceCount = captureId == null ? 0 : 1;
    }

    public static AttendanceBuilder builder() { return new AttendanceBuilder(); }

    public static class AttendanceBuilder {
        private AttendanceSession session;
        private Student student;
        private AttendanceStatus status;
        private double similarity;
        private double margin;
        private Long captureId;

        public AttendanceBuilder session(AttendanceSession session) { this.session = session; return this; }
        public AttendanceBuilder student(Student student) { this.student = student; return this; }
        public AttendanceBuilder status(AttendanceStatus status) { this.status = status; return this; }
        public AttendanceBuilder similarity(double similarity) { this.similarity = similarity; return this; }
        public AttendanceBuilder margin(double margin) { this.margin = margin; return this; }
        public AttendanceBuilder captureId(Long captureId) { this.captureId = captureId; return this; }
        public Attendance build() { return new Attendance(session, student, status, similarity, margin, captureId); }
    }

    public Long getId() { return id; }
    public AttendanceSession getSession() { return session; }
    public Student getStudent() { return student; }
    public AttendanceStatus getStatus() { return status; }
    public double getSimilarity() { return similarity; }
    public double getMargin() { return margin; }
    public int getEvidenceCount() { return evidenceCount; }
    public Long getCaptureId() { return captureId; }
    public Instant getMarkedAt() { return markedAt; }

    public void setStatus(AttendanceStatus status) { this.status = status; }
    public void setSimilarity(double similarity) { this.similarity = similarity; }
    public void setMargin(double margin) { this.margin = margin; }
    public void setEvidenceCount(int evidenceCount) { this.evidenceCount = evidenceCount; }
    public void setCaptureId(Long captureId) { this.captureId = captureId; }
}
