package com.attendance.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "class_rooms")
public class ClassRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "classRoom")
    private List<Student> students = new ArrayList<>();

    public ClassRoom() {}

    private ClassRoom(String name, String code, String description) {
        this.name = name;
        this.code = code;
        this.description = description;
    }

    public static ClassRoomBuilder builder() { return new ClassRoomBuilder(); }

    public static class ClassRoomBuilder {
        private String name;
        private String code;
        private String description;

        public ClassRoomBuilder name(String name) { this.name = name; return this; }
        public ClassRoomBuilder code(String code) { this.code = code; return this; }
        public ClassRoomBuilder description(String description) { this.description = description; return this; }
        public ClassRoom build() { return new ClassRoom(name, code, description); }
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getCode() { return code; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
    public List<Student> getStudents() { return students; }

    public void setDescription(String description) { this.description = description; }
}
