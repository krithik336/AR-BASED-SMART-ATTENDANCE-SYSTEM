package com.attendance.model;

import com.attendance.model.converter.EmbeddingConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.List;

/**
 * One L2-normalised 512-d ArcFace embedding captured from a single enrolled
 * photo. A student normally has several (one per good photo); the matching
 * gallery uses the mean of their embeddings for robustness.
 */
@Entity
@Table(name = "student_embeddings")
public class StudentEmbedding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Convert(converter = EmbeddingConverter.class)
    @Column(nullable = false, length = 20000)
    private List<Double> vector;

    @Column(nullable = false)
    private String model = "buffalo_l";

    @Column(length = 1000)
    private String source;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public StudentEmbedding() {}

    private StudentEmbedding(Student student, List<Double> vector, String source) {
        this.student = student;
        this.vector = vector;
        this.source = source;
    }

    public static StudentEmbeddingBuilder builder() { return new StudentEmbeddingBuilder(); }

    public static class StudentEmbeddingBuilder {
        private Student student;
        private List<Double> vector;
        private String source;

        public StudentEmbeddingBuilder student(Student student) { this.student = student; return this; }
        public StudentEmbeddingBuilder vector(List<Double> vector) { this.vector = vector; return this; }
        public StudentEmbeddingBuilder source(String source) { this.source = source; return this; }
        public StudentEmbedding build() { return new StudentEmbedding(student, vector, source); }
    }

    public Long getId() { return id; }
    public Student getStudent() { return student; }
    public List<Double> getVector() { return vector; }
    public String getModel() { return model; }
    public String getSource() { return source; }
    public Instant getCreatedAt() { return createdAt; }
}
