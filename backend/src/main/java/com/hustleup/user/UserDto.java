package com.hustleup.user;

import lombok.*;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDto {
    private UUID id;
    private String email;
    private String fullName;
    private String phone;
    private String role;
    private String avatarUrl;
    private String shopBannerUrl;
    private String bio;
    private String city;
    private boolean emailVerified;
    private boolean phoneVerified;
    private boolean idVerified;
    private int vouchCount;
    private double avgRating;
    private int followersCount;
    private int followingCount;
    private int activeListingsCount;
    private boolean following;
    private boolean online;

    public static UserDto fromEntity(User user) {
        boolean online = false;
        if (user.getLastActive() != null) {
            online = user.getLastActive().isAfter(java.time.LocalDateTime.now().minusMinutes(5));
        }

        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .avatarUrl(user.getAvatarUrl())
                .shopBannerUrl(user.getShopBannerUrl())
                .bio(user.getBio())
                .city(user.getCity())
                .emailVerified(user.isEmailVerified())
                .phoneVerified(user.isPhoneVerified())
                .idVerified(user.isIdVerified())
                .vouchCount(user.getVouchCount())
                .online(online)
                .build();
    }
}
