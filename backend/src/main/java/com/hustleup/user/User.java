package com.hustleup.user;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Role role = Role.BUYER;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "shop_banner_url")
    private String shopBannerUrl;

    private String bio;
    private String city;

    @Column(name = "is_email_verified")
    @Builder.Default
    private boolean emailVerified = false;

    @Column(name = "is_phone_verified")
    @Builder.Default
    private boolean phoneVerified = false;

    @Column(name = "is_id_verified")
    @Builder.Default
    private boolean idVerified = false;

    @Column(name = "id_document_url")
    private String idDocumentUrl;

    @Column(name = "vouch_count")
    @Builder.Default
    private int vouchCount = 0;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(name = "last_active")
    @Builder.Default
    private LocalDateTime lastActive = LocalDateTime.now();
}
