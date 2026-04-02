package com.hustleup.auth.controller;

import com.hustleup.common.dto.UserDto;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<UserDto>> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll().stream()
                .map(UserDto::fromEntity)
                .collect(Collectors.toList()));
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<UserDto> getProfile(@PathVariable String id) {
        User user = userRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserDto> updateProfile(@RequestBody UserDto profileData) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (profileData.getFullName() != null) user.setFullName(profileData.getFullName());
        if (profileData.getBio() != null) user.setBio(profileData.getBio());
        if (profileData.getCity() != null) user.setCity(profileData.getCity());
        if (profileData.getAvatarUrl() != null) user.setAvatarUrl(profileData.getAvatarUrl());
        if (profileData.getShopBannerUrl() != null) user.setShopBannerUrl(profileData.getShopBannerUrl());
        
        return ResponseEntity.ok(UserDto.fromEntity(userRepository.save(user)));
    }
}
