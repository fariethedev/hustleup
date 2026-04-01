package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.model.DatingProfile;
import com.hustleup.social.repository.DatingProfileRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/dating")
public class DatingController {

    private final DatingProfileRepository datingRepo;
    private final UserRepository userRepo;

    public DatingController(DatingProfileRepository datingRepo, UserRepository userRepo) {
        this.datingRepo = datingRepo;
        this.userRepo = userRepo;
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepo.findByEmail(email).orElseThrow();
    }

    @GetMapping("/profiles")
    public ResponseEntity<List<DatingProfile>> getProfiles() {
        List<DatingProfile> profiles = datingRepo.findAll();
        // If empty, return a mock profile of another user for demo purposes
        if (profiles.isEmpty()) {
            User current = null;
            try { current = getCurrentUser(); } catch (Exception e) {}
            
            final UUID currentId = (current != null) ? current.getId() : null;
            
            List<User> others = userRepo.findAll().stream()
                    .filter(u -> currentId == null || !u.getId().equals(currentId))
                    .limit(10)
                    .toList();
            
            profiles = others.stream().map(u -> DatingProfile.builder()
                    .id(u.getId())
                    .fullName(u.getFullName())
                    .bio(u.getBio() != null ? u.getBio() : "Just a hustler looking for partners and growth opportunities.")
                    .location(u.getCity() != null ? u.getCity() : "London")
                    .imageUrl(u.getAvatarUrl())
                    .lookingFor("Networking")
                    .age(25 + (int)(Math.random() * 5))
                    .build()).toList();
        }
        return ResponseEntity.ok(profiles);
    }

    @PostMapping("/profile")
    public ResponseEntity<DatingProfile> saveProfile(@RequestBody DatingProfile profile) {
        User user = getCurrentUser();
        profile.setId(user.getId());
        profile.setFullName(user.getFullName());
        DatingProfile saved = datingRepo.save(profile);
        return ResponseEntity.ok(saved);
    }
}
