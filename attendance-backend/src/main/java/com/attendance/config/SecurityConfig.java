package com.attendance.config;

import com.attendance.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final UserDetailsService userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;

    /*
     * Can be configured in application.properties:
     *
     * app.cors.allowed-origins=http://localhost:5173,https://localhost:5173
     *
     * Default values are useful for local development.
     */
    @Value("${app.cors.allowed-origins:http://localhost:5173,https://localhost:5173}")
    private String allowedOrigins;

    public SecurityConfig(
            UserDetailsService userDetailsService,
            JwtAuthFilter jwtAuthFilter
    ) {
        this.userDetailsService = userDetailsService;
        this.jwtAuthFilter = jwtAuthFilter;
    }

    /**
     * Password encoder used for storing and verifying passwords.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Authentication provider.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {

        DaoAuthenticationProvider provider =
                new DaoAuthenticationProvider();

        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());

        return provider;
    }

    /**
     * Authentication manager used by the login service.
     */
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config
    ) throws Exception {

        return config.getAuthenticationManager();
    }

    /**
     * Main Spring Security configuration.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http

                /*
                 * JWT-based REST API does not use browser sessions,
                 * so CSRF protection is disabled.
                 */
                .csrf(AbstractHttpConfigurer::disable)

                /*
                 * Enable CORS using our configuration below.
                 */
                .cors(cors ->
                        cors.configurationSource(corsConfigurationSource())
                )

                /*
                 * Do not create HTTP sessions.
                 */
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                /*
                 * Authorization rules.
                 */
                .authorizeHttpRequests(auth -> auth

                        /*
                         * IMPORTANT:
                         *
                         * Browser sends OPTIONS before some POST/PUT/etc.
                         * requests as a CORS preflight request.
                         *
                         * Without this rule Spring Security can return 403.
                         */
                        .requestMatchers(
                                HttpMethod.OPTIONS,
                                "/**"
                        ).permitAll()

                        /*
                         * Public endpoints.
                         */
                        .requestMatchers(
                                "/",
                                "/api/auth/**",
                                "/ws/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**"
                        ).permitAll()

                        /*
                         * Admin-only endpoints.
                         */
                        .requestMatchers(
                                "/api/admin/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/analytics"
                        ).hasRole("ADMIN")

                        /*
                         * Admin and Teacher endpoints.
                         */
                        .requestMatchers(
                                "/api/students/**"
                        ).hasAnyRole("ADMIN", "TEACHER")

                        .requestMatchers(
                                "/api/classes/**"
                        ).hasAnyRole("ADMIN", "TEACHER")

                        .requestMatchers(
                                "/api/sessions/**"
                        ).hasAnyRole("ADMIN", "TEACHER")

                        .requestMatchers(
                                "/api/attendance/**"
                        ).hasAnyRole("ADMIN", "TEACHER")

                        .requestMatchers(
                                "/api/analytics/my"
                        ).hasAnyRole("ADMIN", "TEACHER")

                        /*
                         * Everything else requires authentication.
                         */
                        .anyRequest().authenticated()
                )

                /*
                 * Tell Spring Security which authentication provider
                 * should be used.
                 */
                .authenticationProvider(authenticationProvider())

                /*
                 * Run our JWT filter before Spring's username/password
                 * authentication filter.
                 */
                .addFilterBefore(
                        jwtAuthFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    /**
     * CORS configuration.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration =
                new CorsConfiguration();

        /*
         * Read allowed origins from application.properties.
         *
         * Example:
         *
         * http://localhost:5173
         * https://localhost:5173
         */
        List<String> origins = Arrays.stream(
                        allowedOrigins.split(",")
                )
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();

        configuration.setAllowedOrigins(origins);

        /*
         * HTTP methods allowed from the frontend.
         */
        configuration.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        /*
         * Allow Authorization, Content-Type, etc.
         */
        configuration.setAllowedHeaders(List.of("*"));

        /*
         * Required if the frontend sends credentials/cookies.
         *
         * This is also compatible with your JWT setup.
         */
        configuration.setAllowCredentials(true);

        /*
         * Optional response headers that the frontend may read.
         */
        configuration.setExposedHeaders(List.of(
                "Authorization"
        ));

        /*
         * Cache the CORS preflight result for 1 hour.
         */
        configuration.setMaxAge(3600L);

        /*
         * Apply CORS configuration to every endpoint.
         */
        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                configuration
        );

        return source;
    }
}