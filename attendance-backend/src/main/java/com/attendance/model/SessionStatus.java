package com.attendance.model;

public enum SessionStatus {
    ACTIVE,
    ENDED,
    /** Session abandoned before attendance was submitted. Any records created
     *  during capture are retained but do not count as a final attendance. */
    CANCELLED
}
