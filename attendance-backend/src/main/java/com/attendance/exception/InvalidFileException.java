package com.attendance.exception;

/**
 * Raised when an uploaded file fails validation (wrong type, empty, corrupt,
 * too large, or an image that contains no usable face).
 */
public class InvalidFileException extends RuntimeException {
    public InvalidFileException(String message) {
        super(message);
    }

    public InvalidFileException(String message, Throwable cause) {
        super(message, cause);
    }
}
