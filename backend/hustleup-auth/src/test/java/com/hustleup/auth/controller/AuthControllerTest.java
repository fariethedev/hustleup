package com.hustleup.auth.controller;

import com.hustleup.auth.dto.AuthDtos;
import com.hustleup.auth.model.RefreshToken;
import com.hustleup.auth.repository.RefreshTokenRepository;
import com.hustleup.common.security.JwtTokenProvider;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.*;

// =====================================================================================
// JUnit 5 & Mockito Getting Started Guide
// =====================================================================================
// 1. @ExtendWith(MockitoExtension.class): This tells JUnit 5 to enable Mockito annotations 
//    like @Mock and @InjectMocks. Without this, your mocks will be strictly null.
// 2. @Mock: Creates a "dummy" or "mock" object of a class or interface. It does not hit the
//    real database, does not encode passwords, etc. You define its behavior using `when()`.
// 3. @InjectMocks: Creates an instance of the class you are testing (AuthController) and 
//    automatically injects the @Mock objects into its constructor.
// 4. Arrange/Act/Assert: Standard testing pattern. 
//      - Arrange (setup mock behavior)
//      - Act (call the method you are testing)
//      - Assert (verify the results using JUnit's assertEquals, etc.)
// =====================================================================================

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    // -------------------------------------------------------------------------
    // 1. Define Mocks for all the dependencies of the AuthController
    // -------------------------------------------------------------------------
    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private Authentication authentication; // Mocking the Authentication object returned by Spring Security

    // -------------------------------------------------------------------------
    // 2. Inject the mocks into the actual controller we want to test
    // -------------------------------------------------------------------------
    @InjectMocks
    private AuthController authController;

    private User mockUser;

    // -------------------------------------------------------------------------
    // 3. Setup common data used across multiple tests
    // -------------------------------------------------------------------------
    @BeforeEach
    void setUp() {
        // This runs before EVERY @Test method. Great for setting up standard mock objects.
        mockUser = User.builder()
                .id(UUID.randomUUID())
                .email("test@example.com")
                .password("hashed_password")
                .fullName("Test User")
                .role(Role.SELLER)
                .build();
    }

    // -------------------------------------------------------------------------
    // 4. Write tests with descriptive names
    // -------------------------------------------------------------------------
    
    @Test
    @DisplayName("Should returning 400 Bad Request when trying to register an existing email")
    void register_ExistingEmail_ReturnsBadRequest() {
        // ==========================================
        // ARRANGE
        // ==========================================
        AuthDtos.RegisterRequest request = new AuthDtos.RegisterRequest();
        request.setEmail("test@example.com");

        // "when" is Mockito. It means: "When the AuthController calls userRepository.existsByEmail("test@example.com"),
        // then return true instead of actually hitting the database."
        when(userRepository.existsByEmail("test@example.com")).thenReturn(true);

        // ==========================================
        // ACT
        // ==========================================
        // Call the real method on the controller
        ResponseEntity<?> response = authController.register(request);

        // ==========================================
        // ASSERT
        // ==========================================
        // Validate the HTTP Status Code
        org.junit.jupiter.api.Assertions.assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode(), "Status should be 400");
        
        // Validate the response body
        Map<String, String> body = (Map<String, String>) response.getBody();
        org.junit.jupiter.api.Assertions.assertEquals("Email already registered", body.get("error"));
        
        // Optional: verify that passwordEncoder.encode() was NEVER called because we exited early.
        // Mockito.verify(passwordEncoder, Mockito.never()).encode(Mockito.anyString());
    }

    @Test
    @DisplayName("Should successfully authenticate a user and return tokens")
    void login_ValidCredentials_ReturnsTokens() {
        // ==========================================
        // ARRANGE
        // ==========================================
        AuthDtos.LoginRequest request = new AuthDtos.LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("password123");

        // Mock the AuthenticationManager to return a valid Authentication object
        // Mockito.any() matches any object passed to it.
        when(authenticationManager.authenticate(org.mockito.ArgumentMatchers.any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        
        // We need auth.getName() to return the email for token generation
        when(authentication.getName()).thenReturn("test@example.com");

        // Mock the repository call to return our mockUser
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(mockUser));

        // Mock the token generation
        when(tokenProvider.generateAccessToken("test@example.com", "SELLER")).thenReturn("mock_access_token");
        when(tokenProvider.generateRefreshToken("test@example.com")).thenReturn("mock_refresh_token");

        // ==========================================
        // ACT
        // ==========================================
        ResponseEntity<?> response = authController.login(request);

        // ==========================================
        // ASSERT
        // ==========================================
        org.junit.jupiter.api.Assertions.assertEquals(HttpStatus.OK, response.getStatusCode());
        
        AuthDtos.AuthResponse authResponse = (AuthDtos.AuthResponse) response.getBody();
        org.junit.jupiter.api.Assertions.assertNotNull(authResponse);
        org.junit.jupiter.api.Assertions.assertEquals("mock_access_token", authResponse.getAccessToken());
        org.junit.jupiter.api.Assertions.assertEquals("mock_refresh_token", authResponse.getRefreshToken());
        org.junit.jupiter.api.Assertions.assertEquals("Test User", authResponse.getFullName());
        org.junit.jupiter.api.Assertions.assertEquals("SELLER", authResponse.getRole());

        // We can also verify that a specific mocked method was called exactly once.
        // Example: Ensure the refresh token was actually saved to the database.
        org.mockito.Mockito.verify(refreshTokenRepository, org.mockito.Mockito.times(1))
                .save(org.mockito.ArgumentMatchers.any(RefreshToken.class));
    }
}
