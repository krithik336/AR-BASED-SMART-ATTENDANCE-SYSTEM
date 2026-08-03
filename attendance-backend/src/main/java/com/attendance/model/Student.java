package com.attendance.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
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
@Table(name = "students")
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String rollNumber;

    @Column
    private String email;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_room_id", nullable = false)
    private ClassRoom classRoom;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "student_photos", joinColumns = @JoinColumn(name = "student_id"))
    @Column(name = "photo_path", length = 1000)
    private List<String> photoPaths = new ArrayList<>();

    @OneToMany(mappedBy = "student", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StudentEmbedding> embeddings = new ArrayList<>();

    @Column(nullable = false)
    private boolean faceRegistered = false;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Student() {}

    private Student(String name, String rollNumber, String email, ClassRoom classRoom) {
        this.name = name;
        this.rollNumber = rollNumber;
        this.email = email;
        this.classRoom = classRoom;
    }

    public static StudentBuilder builder() { return new StudentBuilder(); }

    public static class StudentBuilder {
        private String name;
        private String rollNumber;
        private String email;
        private ClassRoom classRoom;

        public StudentBuilder name(String name) { this.name = name; return this; }
        public StudentBuilder rollNumber(String rollNumber) { this.rollNumber = rollNumber; return this; }
        public StudentBuilder email(String email) { this.email = email; return this; }
        public StudentBuilder classRoom(ClassRoom classRoom) { this.classRoom = classRoom; return this; }
        public Student build() { return new Student(name, rollNumber, email, classRoom); }
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getRollNumber() { return rollNumber; }
    public String getEmail() { return email; }
    public ClassRoom getClassRoom() { return classRoom; }
    public List<String> getPhotoPaths() { return photoPaths; }
    public List<StudentEmbedding> getEmbeddings() { return embeddings; }
    public boolean isFaceRegistered() { return faceRegistered; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }

    public void setName(String name) { this.name = name; }
    public void setRollNumber(String rollNumber) { this.rollNumber = rollNumber; }
    public void setEmail(String email) { this.email = email; }
    public void setClassRoom(ClassRoom classRoom) { this.classRoom = classRoom; }
    public void setFaceRegistered(boolean faceRegistered) { this.faceRegistered = faceRegistered; }
    public void setActive(boolean active) { this.active = active; }

    public void addPhotoPath(String path) { this.photoPaths.add(path); }
    public void addEmbedding(StudentEmbedding embedding) { this.embeddings.add(embedding); }
}
