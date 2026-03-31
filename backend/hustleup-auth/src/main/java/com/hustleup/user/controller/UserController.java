package com.hustleup.user.controller;

import com.hustleup.common.dto.UserDto;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<UserDto>> getUsers() {
        List<UserDto> users = userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::buildUserDto)
                .toList();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<?> getProfile(@PathVariable UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        UserDto dto = buildUserDto(user);
        
        // Follow status and listing counts should be fetched from respective services in a real microservice setup.
        // For now, we'll return the basic profile.

        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/me")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (body.containsKey("fullName")) user.setFullName(body.get("fullName"));
        if (body.containsKey("phone")) user.setPhone(body.get("phone"));
        if (body.containsKey("bio")) user.setBio(body.get("bio"));
        if (body.containsKey("city")) user.setCity(body.get("city"));
        if (body.containsKey("shopBannerUrl")) user.setShopBannerUrl(body.get("shopBannerUrl"));

        userRepository.save(user);
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }

    private UserDto buildUserDto(User user) {
        return UserDto.fromEntity(user);
    }
}
