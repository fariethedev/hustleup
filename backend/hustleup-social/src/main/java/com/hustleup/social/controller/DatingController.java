package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.social.model.DatingProfile;
import com.hustleup.social.repository.DatingProfileRepository;
import com.hustleup.common.storage.FileStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/dating")
public class DatingController {

    private final DatingProfileRepository datingRepo;
    private final UserRepository userRepo;
    private final FileStorageService storageService;

    public DatingController(DatingProfileRepository datingRepo, UserRepository userRepo,
                            FileStorageService storageService) {
        this.datingRepo = datingRepo;
        this.userRepo = userRepo;
        this.storageService = storageService;
    }

    private User getCurrentUser() {
        org.springframework.security.core.Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return null;
        }
        return userRepo.findByEmail(auth.getName()).orElse(null);
    }

    @GetMapping("/profiles")
    public ResponseEntity<List<DatingProfile>> getProfiles() {
        try {
            // Build map of saved dating profiles
            Map<UUID, DatingProfile> profileMap = datingRepo.findAll().stream()
                    .collect(Collectors.toMap(DatingProfile::getId, p -> p));

            UUID currentId = null;
            try {
                User current = getCurrentUser();
                if (current != null) currentId = current.getId();
            } catch (Exception ignored) {}

            final UUID finalCurrentId = currentId;

            // Return all users as discoverable profiles, enriched with dating profile if they have one
            List<DatingProfile> result = userRepo.findAll().stream()
                    .filter(u -> finalCurrentId == null || !u.getId().equals(finalCurrentId))
                    .map(u -> {
                        DatingProfile dp = profileMap.get(u.getId());
                        if (dp != null) return dp;
                        return DatingProfile.builder()
                                .id(u.getId())
                                .fullName(u.getFullName())
                                .bio(u.getBio() != null ? u.getBio() : "Just a hustler on the grind.")
                                .location(u.getCity() != null ? u.getCity() : "")
                                .imageUrl(u.getAvatarUrl())
                                .lookingFor("Networking")
                                .age(0)
                                .build();
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/profile/me")
    public ResponseEntity<?> getMyProfile() {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();
        Optional<DatingProfile> profile = datingRepo.findById(user.getId());
        return ResponseEntity.ok(profile.orElse(null));
    }

    @PostMapping("/profile")
    public ResponseEntity<?> saveProfile(
            @RequestParam(value = "bio", required = false) String bio,
            @RequestParam(value = "age", required = false) Integer age,
            @RequestParam(value = "location", required = false) String location,
            @RequestParam(value = "lookingFor", required = false) String lookingFor,
            @RequestParam(value = "interests", required = false) String interests,
            @RequestParam(value = "gender", required = false) String gender,
            @RequestParam(value = "image", required = false) MultipartFile image) {

        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).build();

        DatingProfile profile = datingRepo.findById(user.getId())
                .orElse(DatingProfile.builder().id(user.getId()).build());

        profile.setFullName(user.getFullName());
        if (bio != null) profile.setBio(bio);
        if (age != null) profile.setAge(age);
        if (location != null) profile.setLocation(location);
        if (lookingFor != null) profile.setLookingFor(lookingFor);
        if (interests != null) profile.setInterests(interests);
        if (gender != null) profile.setGender(gender);
        if (image != null && !image.isEmpty()) {
            profile.setImageUrl(storageService.store(image));
        } else if (profile.getImageUrl() == null) {
            profile.setImageUrl(user.getAvatarUrl());
        }

        DatingProfile saved = datingRepo.save(profile);
        return ResponseEntity.ok(saved);
    }
}
