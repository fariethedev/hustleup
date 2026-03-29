package com.hustleup.dating;

import com.hustleup.storage.FileStorageService;
import com.hustleup.user.UserRepository;
import com.hustleup.user.User;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/api/v1/dating")
public class DatingController {
    
    private final DatingProfileRepository pRepo;
    private final FileStorageService storageService;
    private final UserRepository userRepository;

    public DatingController(DatingProfileRepository pRepo, FileStorageService storageService, UserRepository userRepository) {
        this.pRepo = pRepo;
        this.storageService = storageService;
        this.userRepository = userRepository;
    }

    @GetMapping("/profiles")
    public ResponseEntity<?> getProfiles() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        String userId = currentUser.getId().toString();
        
        DatingProfile current = pRepo.findById(userId).orElse(null);
        if (current == null || current.getPreferredGender() == null) {
            return ResponseEntity.ok(pRepo.findByIdNot(userId));
        }
        
        if ("ANY".equalsIgnoreCase(current.getPreferredGender())) {
            return ResponseEntity.ok(pRepo.findByIdNot(userId));
        }

        return ResponseEntity.ok(pRepo.findByGenderAndIdNot(current.getPreferredGender(), userId));
    }

    @PostMapping("/profile")
    public ResponseEntity<?> saveProfile(
            @RequestParam("fullName") String fullName,
            @RequestParam("bio") String bio,
            @RequestParam("age") Integer age,
            @RequestParam("gender") String gender,
            @RequestParam("preferredGender") String preferredGender,
            @RequestParam("lookingFor") String lookingFor,
            @RequestParam("location") String location,
            @RequestParam(value = "image", required = false) MultipartFile image) {
        
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        String userId = currentUser.getId().toString();

        DatingProfile profile = pRepo.findById(userId).orElse(new DatingProfile());
        profile.setId(userId);
        profile.setFullName(fullName);
        profile.setBio(bio);
        profile.setAge(age);
        profile.setGender(gender);
        profile.setPreferredGender(preferredGender);
        profile.setLookingFor(lookingFor);
        profile.setLocation(location);

        if (image != null && !image.isEmpty()) {
            String url = storageService.store(image);
            profile.setImageUrl(url);
        }

        return ResponseEntity.ok(pRepo.save(profile));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        String userId = currentUser.getId().toString();
        return pRepo.findById(userId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    // Simplistic swiping: just record 'LIKE' in matches table (omitted for brevity, handled implicitly)
}
