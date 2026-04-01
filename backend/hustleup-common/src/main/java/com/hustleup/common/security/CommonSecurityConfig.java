package com.hustleup.common.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.beans.factory.annotation.Value;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class CommonSecurityConfig {

    @Bean
    public JwtTokenProvider jwtTokenProvider(
            @Value("${app.jwt.secret:defaultSecretKeyWithEnoughEntropyForHMacSha256_32CharactersMinimum}") String secret,
            @Value("${app.jwt.access-token-expiration-ms:3600000}") long accessTokenExpirationMs,
            @Value("${app.jwt.refresh-token-expiration-ms:86400000}") long refreshTokenExpirationMs) {
        return new JwtTokenProvider(secret, accessTokenExpirationMs, refreshTokenExpirationMs);
    }

    @Bean
    public CommonJwtFilter commonJwtFilter(JwtTokenProvider tokenProvider) {
        return new CommonJwtFilter(tokenProvider);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, CommonJwtFilter jwtFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/api/v1/public/**", "/uploads/**").permitAll()
                .requestMatchers("/api/v1/listings/**", "/api/v1/feed/**", "/api/v1/stories/**").permitAll() // Publicly viewable
                .anyRequest().authenticated()
            );

        http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
