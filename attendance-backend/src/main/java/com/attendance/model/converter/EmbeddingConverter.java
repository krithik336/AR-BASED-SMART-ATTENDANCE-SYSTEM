package com.attendance.model.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.io.IOException;
import java.util.List;

/**
 * Maps a 512-d ArcFace embedding ({@link List}<Double>) to a compact JSON
 * string column. Keeps embeddings queryable and portable across databases
 * without requiring a native array column type.
 */
@Converter
public class EmbeddingConverter implements AttributeConverter<List<Double>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(List<Double> attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize embedding", ex);
        }
    }

    @Override
    public List<Double> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(dbData, new TypeReference<List<Double>>() { });
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to deserialize embedding", ex);
        }
    }
}
