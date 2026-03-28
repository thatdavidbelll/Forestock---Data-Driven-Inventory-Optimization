package com.forestock.forestock_backend.config;

import com.forestock.forestock_backend.security.JwtAuthFilter;
import com.forestock.forestock_backend.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.MediaType;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/verify-email",
            "/api/auth/resend-verification",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/actuator/**",         // health + metrics (Spring Boot 4.x needs the wildcard)
            "/error",               // Spring error dispatch
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**"
    };

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    // Platform-level admin: only SUPER_ADMIN can create stores or access admin panel
                    .requestMatchers("/api/register").hasRole("SUPER_ADMIN")
                    .requestMatchers("/api/admin/**").hasRole("SUPER_ADMIN")
                    // Store-level user management: only store ADMIN
                    .requestMatchers(org.springframework.http.HttpMethod.GET,  "/api/users").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.PUT,  "/api/users/{id}").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/users/{id}").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/audit-logs").hasRole("ADMIN")
                    // Password change: any authenticated user for their own account
                    .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/users/me/password").authenticated()
                    .anyRequest().authenticated())
            .exceptionHandling(e -> e.authenticationEntryPoint(
                    (req, res, ex) -> {
                        res.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                        res.getWriter().write("{\"status\":\"error\",\"message\":\"Unauthorized — please log in.\"}");
                    }
            ))
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
