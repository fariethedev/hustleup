package com.hustleup.dating;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "dating_profiles")
@Data
public class DatingProfile {
    @Id
    @Column(name = "user_id")
    private String id; // Use user's main ID

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(columnDefinition = "TEXT")
    private String bio;

    private Integer age;

    private String gender;

    @Column(name = "preferred_gender")
    private String preferredGender;

    @Column(name = "looking_for")
    private String lookingFor;

    @Column(name = "image_url")
    private String imageUrl;

    private String location;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
