package com.attendance.service;

import com.attendance.exception.InvalidFileException;
import com.attendance.exception.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Validates, sanitises and persists uploaded student photos under
 * {@code app.storage.path}. Every stored file gets a random UUID name so the
 * original (potentially hostile) filename is never used on disk.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private static final long MAX_IMAGE_BYTES = 8L * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/pjpeg", "image/png", "image/webp", "image/bmp"
    );
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "bmp"
    );

    private final Path root;

    public StorageService(@Value("${app.storage.path:./uploads}") String storagePath) {
        this.root = Path.of(storagePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to create storage directory: " + root, ex);
        }
        log.info("File storage root: {}", root);
    }

    /**
     * Stores an image under {@code <root>/<subDir>/<key>/<uuid>.<ext>}.
     *
     * @return the relative path (forward slashes) usable to read the file back.
     */
    public String store(MultipartFile file, String subDir, String key) {
        validate(file);
        String extension = resolveExtension(file);

        String fileName = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path directory = root
                .resolve(sanitizeSegment(subDir))
                .resolve(sanitizeSegment(key))
                .normalize();
        if (!directory.startsWith(root)) {
            throw new InvalidFileException("Invalid storage path");
        }
        try {
            Files.createDirectories(directory);
            Path target = directory.resolve(fileName);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            throw new InvalidFileException("Failed to store uploaded image", ex);
        }
        return root.relativize(directory.resolve(fileName)).toString().replace('\\', '/');
    }

    /** Resolves a stored relative path to a loadable {@link Resource}. */
    public Resource load(String relativePath) {
        Path path = root.resolve(relativePath).normalize();
        if (!path.startsWith(root)) {
            throw new NotFoundException("Invalid file path");
        }
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throw new NotFoundException("File not found");
        }
        try {
            return new UrlResource(path.toUri());
        } catch (MalformedURLException ex) {
            throw new NotFoundException("File not found");
        }
    }

    /** Best-effort deletion used for cleanup after a failed registration. */
    public void deleteQuietly(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }
        try {
            Path path = root.resolve(relativePath).normalize();
            if (path.startsWith(root)) {
                Files.deleteIfExists(path);
            }
        } catch (IOException ex) {
            log.warn("Failed to delete file '{}': {}", relativePath, ex.getMessage());
        }
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidFileException("Uploaded file is empty");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new InvalidFileException("Image exceeds the maximum allowed size of 8MB");
        }
        String contentType = file.getContentType();
        if (contentType != null && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new InvalidFileException("Unsupported image type: " + contentType);
        }
    }

    private String resolveExtension(MultipartFile file) {
        String original = file.getOriginalFilename();
        String extension = null;
        if (original != null && original.contains(".")) {
            extension = original.substring(original.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        }
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension)) {
            extension = "jpg";
        }
        return extension;
    }

    private String sanitizeSegment(String value) {
        String cleaned = value == null ? "" : value.replaceAll("[^A-Za-z0-9._-]", "_");
        return cleaned.isEmpty() ? "_" : cleaned;
    }
}
