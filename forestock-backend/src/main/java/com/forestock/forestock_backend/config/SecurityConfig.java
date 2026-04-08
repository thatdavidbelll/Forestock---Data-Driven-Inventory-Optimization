package com.forestock.forestock_backend.config;

import com.forestock.forestock_backend.security.JwtAuthFilter;
import com.forestock.forestock_backend.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.security.config.Customizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.MediaType;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;

    @Value("${forestock.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    private static final String[] PUBLIC_ENDPOINTS = {
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/verify-email",
            "/api/auth/invite/verify",
            "/api/auth/invite/accept",
            "/api/auth/resend-verification",
            "/api/auth/forgot-password",
            "/api/auth/reset-password",
            "/api/auth/standalone-access/request",
            "/api/auth/standalone-access/verify",
            "/api/auth/standalone-access/activate",
            "/api/webhooks/shopify/**",
            "/actuator/health",
            "/actuator/health/**",
            "/error",               // Spring error dispatch
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/v3/api-docs/**"
    };

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/shopify/provision").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/shopify/catalog-sync").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/shopify/product-delete").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/shopify/inventory-sync").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/shopify/order-backfill").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/shopify/disconnect").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/shopify/app-home").permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/shopify/recommendations").permitAll()
                    // Platform-level admin: only SUPER_ADMIN can create stores or access admin panel
                    .requestMatchers("/api/register").hasRole("SUPER_ADMIN")
                    .requestMatchers("/api/admin/**").hasRole("SUPER_ADMIN")
                    // Store-level user management: only store ADMIN
                    .requestMatchers(org.springframework.http.HttpMethod.GET,  "/api/users").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users/invite").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/users/invites").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/users/invites/{id}").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.PUT,  "/api/users/{id}").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/users/{id}").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/audit-logs").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/store/shopify").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/store/shopify").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/store/shopify/toggle").hasRole("ADMIN")
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/store/shopify").hasAnyRole("ADMIN", "MANAGER")
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
            .headers(headers -> headers
                    .frameOptions(frameOptions -> frameOptions.deny())
                    .contentTypeOptions(Customizer.withDefaults())
                    .httpStrictTransportSecurity(hsts -> hsts
                            .maxAgeInSeconds(31536000)
                            .includeSubDomains(true)
                            .preload(true))
            )
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

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(frontendUrl.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
