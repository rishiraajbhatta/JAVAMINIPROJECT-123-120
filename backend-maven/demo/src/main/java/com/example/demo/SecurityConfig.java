package com.example.demo;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http)
            throws Exception {

        http
            .cors(Customizer.withDefaults())

            .csrf(csrf -> csrf.disable())

            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
            )

            .authorizeHttpRequests(authorize -> authorize

                // Public health API
                .requestMatchers("/api/health").permitAll()

                // Patient registration and login
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/patients/register",
                    "/api/patients/login",
                    "/api/patients/logout"
                ).permitAll()

                // Doctor registration and login
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/doctors/register",
                    "/api/doctors/login"
                ).permitAll()

                // Receptionist login
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/receptionist/login"
                ).permitAll()

                // Public doctor listing
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/doctors"
                ).permitAll()

                // Patient appointment booking and payment verification
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/appointments/book",
                    "/api/appointments/verify-payment"
                ).hasRole("PATIENT")

                // Doctor appointment dashboard
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/appointments/doctor"
                ).hasRole("DOCTOR")

                // Receptionist APIs
                .requestMatchers(
                    "/api/receptionist/**"
                ).hasRole("RECEPTIONIST")

                // Patient APIs
                .requestMatchers(
                    "/api/patients/**"
                ).hasRole("PATIENT")

                // Doctor APIs
                .requestMatchers(
                    "/api/doctors/**"
                ).hasRole("DOCTOR")

                // All other requests require authentication
                .anyRequest().authenticated()
            )

            // Disable default login mechanisms
            .httpBasic(httpBasic -> httpBasic.disable())
            .formLogin(formLogin -> formLogin.disable());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration = new CorsConfiguration();

        // Allowed frontend origins
        configuration.setAllowedOrigins(
            List.of(
                "http://localhost:3000",
                "https://curasync-inq69hfa2-rishiraajbhatta.vercel.app",
                "https://curasync-c3nns33a9-rishiraajbhatta.vercel.app"
            )
        );

        // Allowed HTTP methods
        configuration.setAllowedMethods(
            List.of(
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "OPTIONS"
            )
        );

        // Allowed request headers
        configuration.setAllowedHeaders(
            List.of(
                "Content-Type",
                "Authorization"
            )
        );

        // Allow session cookies
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
            new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/api/**", configuration);

        return source;
    }
}