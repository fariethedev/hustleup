package com.hustleup.common.dto;

import com.hustleup.common.model.User;
import lombok.*;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDto {
    private UUID id;
    private String email;
    private String fullName;
    private String role;
    private String avatarUrl;
    private String shopBannerUrl;
    private String bio;
    private String city;
    private String phone;
    private boolean idVerified;
    private Boolean onboardingCompleted;

    public static UserDto fromEntity(User user) {
        if (user == null) return new UserDto();
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole() != null ? user.getRole().name() : null)
                .avatarUrl(user.getAvatarUrl())
                .shopBannerUrl(user.getShopBannerUrl())
                .bio(user.getBio())
                .city(user.getCity())
                .phone(user.getPhone())
                .idVerified(user.isIdVerified())
                .onboardingCompleted(user.getOnboardingCompleted())
                .build();
    }
}
