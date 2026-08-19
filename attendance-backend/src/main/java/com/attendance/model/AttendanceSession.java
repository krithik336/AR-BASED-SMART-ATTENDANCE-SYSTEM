package com.attendance.model;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "attendance_sessions")
public class AttendanceSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_room_id", nullable = false)
    private ClassRoom classRoom;

    @Column(nullable = false)
    private Long teacherId;

    @Column(length = 300)
    private String subject;

    @Column(nullable = false, updatable = false)
    private Instant startedAt = Instant.now();

    private Instant endedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status = SessionStatus.ACTIVE;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Attendance> records = new ArrayList<>();

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AttendanceCapture> captures = new ArrayList<>();

    public AttendanceSession() {}

    private AttendanceSession(ClassRoom classRoom, Long teacherId, String subject) {
        this.classRoom = classRoom;
        this.teacherId = teacherId;
        this.subject = subject;
    }

    public static AttendanceSessionBuilder builder() { return new AttendanceSessionBuilder(); }

    public static class AttendanceSessionBuilder {
        private ClassRoom classRoom;
        private Long teacherId;
        private String subject;

        public AttendanceSessionBuilder classRoom(ClassRoom classRoom) { this.classRoom = classRoom; return this; }
        public AttendanceSessionBuilder teacherId(Long teacherId) { this.teacherId = teacherId; return this; }
        public AttendanceSessionBuilder subject(String subject) { this.subject = subject; return this; }
        public AttendanceSession build() { return new AttendanceSession(classRoom, teacherId, subject); }
    }

    public Long getId() { return id; }
    public ClassRoom getClassRoom() { return classRoom; }
    public Long getTeacherId() { return teacherId; }
    public String getSubject() { return subject; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getEndedAt() { return endedAt; }
    public SessionStatus getStatus() { return status; }
    public List<Attendance> getRecords() { return records; }
    public List<AttendanceCapture> getCaptures() { return captures; }

    public void end() {
        this.status = SessionStatus.ENDED;
        this.endedAt = Instant.now();
    }

    public void cancel() {
        this.status = SessionStatus.CANCELLED;
        this.endedAt = Instant.now();
    }

    public void addCapture(AttendanceCapture capture) { this.captures.add(capture); }
}
