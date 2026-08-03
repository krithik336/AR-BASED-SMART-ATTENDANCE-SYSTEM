package com.attendance.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Resolves the authenticated user from the security context. Controllers use
 * this instead of touching Spring Security internals directly.
 */
@Component
public class CurrentUser {

    public Long id() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserDetails user)) {
            throw new IllegalStateException("No authenticated user in context");
        }
        return user.getId();
    }

    public String email() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserDetails user)) {
            throw new IllegalStateException("No authenticated user in context");
        }
        return user.getEmail();
    }
}
