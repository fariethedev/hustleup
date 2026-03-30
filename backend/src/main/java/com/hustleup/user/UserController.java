package com.hustleup.user;

import com.hustleup.listing.ListingRepository;
import com.hustleup.listing.ListingStatus;
import com.hustleup.review.ReviewRepository;
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
    private final ReviewRepository reviewRepository;
    private final FollowRepository followRepository;
    private final ListingRepository listingRepository;

    public UserController(UserRepository userRepository, ReviewRepository reviewRepository, FollowRepository followRepository,
                          ListingRepository listingRepository) {
        this.userRepository = userRepository;
        this.reviewRepository = reviewRepository;
        this.followRepository = followRepository;
        this.listingRepository = listingRepository;
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
        
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User currentUser = userRepository.findByEmail(email).orElse(null);
            if (currentUser != null && !email.equals("anonymousUser")) {
                dto.setFollowing(followRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), id));
            }
        } catch (Exception e) {}

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

    @PostMapping("/{id}/follow")
    public ResponseEntity<?> followUser(@PathVariable UUID id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        
        if (!currentUser.getId().equals(id) && !followRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), id)) {
            Follow follow = new Follow();
            follow.setFollowerId(currentUser.getId());
            follow.setFollowingId(id);
            followRepository.save(follow);
        }
        return getProfile(id);
    }

    @DeleteMapping("/{id}/follow")
    public ResponseEntity<?> unfollowUser(@PathVariable UUID id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow();
        
        followRepository.findByFollowerIdAndFollowingId(currentUser.getId(), id)
            .ifPresent(followRepository::delete);
        
        return getProfile(id);
    }

    private UserDto buildUserDto(User user) {
        UserDto dto = UserDto.fromEntity(user);
        Double avg = reviewRepository.averageRatingForUser(user.getId());
        dto.setAvgRating(avg != null ? avg : 0.0);
        dto.setFollowersCount(followRepository.countByFollowingId(user.getId()));
        dto.setFollowingCount(followRepository.countByFollowerId(user.getId()));
        dto.setActiveListingsCount(listingRepository.countBySellerIdAndStatus(user.getId(), ListingStatus.ACTIVE));
        return dto;
    }
}
