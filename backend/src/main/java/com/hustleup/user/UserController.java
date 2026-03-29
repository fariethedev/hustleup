package com.hustleup.user;

import com.hustleup.review.ReviewRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;

    public UserController(UserRepository userRepository, ReviewRepository reviewRepository) {
        this.userRepository = userRepository;
        this.reviewRepository = reviewRepository;
    }

    @GetMapping("/{id}/profile")
    public ResponseEntity<?> getProfile(@PathVariable UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        UserDto dto = UserDto.fromEntity(user);
        Double avg = reviewRepository.averageRatingForUser(id);
        dto.setAvgRating(avg != null ? avg : 0.0);
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

        userRepository.save(user);
        return ResponseEntity.ok(UserDto.fromEntity(user));
    }
}
