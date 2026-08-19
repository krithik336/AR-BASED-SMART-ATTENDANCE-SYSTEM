package com.attendance.security;

import com.attendance.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log =
            LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    public JwtAuthFilter(
            JwtUtil jwtUtil,
            CustomUserDetailsService userDetailsService
    ) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        /*
         * IMPORTANT:
         *
         * Browsers send an OPTIONS request before certain
         * cross-origin requests as a CORS preflight.
         *
         * OPTIONS requests do not contain a JWT.
         *
         * Therefore, let the request pass through immediately.
         */
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        /*
         * Get Authorization header.
         */
        final String authHeader =
                request.getHeader("Authorization");

        /*
         * No JWT:
         *
         * Let Spring Security decide whether this endpoint
         * is public or requires authentication.
         */
        if (authHeader == null ||
                !authHeader.startsWith("Bearer ")) {

            filterChain.doFilter(request, response);
            return;
        }

        try {

            /*
             * Remove "Bearer " from the Authorization header.
             */
            final String jwt =
                    authHeader.substring(7);

            /*
             * Extract email/username from JWT.
             */
            final String userEmail =
                    jwtUtil.extractUsername(jwt);

            /*
             * Only authenticate if:
             *
             * 1. Username exists
             * 2. No authentication has already been established
             */
            if (userEmail != null &&
                    SecurityContextHolder
                            .getContext()
                            .getAuthentication() == null) {

                /*
                 * Load user from database.
                 */
                UserDetails userDetails =
                        userDetailsService
                                .loadUserByUsername(userEmail);

                /*
                 * Validate JWT.
                 */
                if (jwtUtil.isTokenValid(jwt, userDetails)) {

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );

                    /*
                     * Attach request details.
                     */
                    authToken.setDetails(
                            new WebAuthenticationDetailsSource()
                                    .buildDetails(request)
                    );

                    /*
                     * Put authenticated user into
                     * Spring Security context.
                     */
                    SecurityContextHolder
                            .getContext()
                            .setAuthentication(authToken);

                    log.debug(
                            "Authenticated user: {}",
                            userEmail
                    );
                }
            }

        } catch (Exception ex) {

            /*
             * Do not crash the request when an invalid JWT
             * is supplied.
             *
             * Spring Security will handle authorization later.
             */
            log.warn(
                    "JWT authentication failed: {}",
                    ex.getMessage()
            );
        }

        /*
         * Continue the filter chain.
         */
        filterChain.doFilter(request, response);
    }
}