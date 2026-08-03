package com.attendance.service;

import com.attendance.model.Role;
import com.attendance.model.User;
import com.attendance.repository.UserRepository;
import com.attendance.security.AppUserDetails;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Loads users for authentication, returning {@link AppUserDetails} so the
 * database user id is available to controllers via {@link CurrentUser}.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("No user found with email: " + email));

        return new AppUserDetails(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getPassword(),
                Role.TEACHER == user.getRole() ? "TEACHER" : "ADMIN");
    }
}
