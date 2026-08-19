package com.attendance.model;

public enum AttendanceStatus {
    PRESENT,
    ABSENT,
    UNVERIFIED,
    /** Detected with a usable match but the best-vs-second-best margin is too
     *  small (or face quality is borderline). Needs the teacher's decision. */
    REVIEW
}
