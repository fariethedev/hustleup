package com.hustleup.social.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "dating_profiles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DatingProfile {
    @Id
    private UUID id; // Same as userId

    private String fullName;
    private Integer age;
    private String gender;
    private String lookingFor;
    private String bio;
    private String location;
    private String imageUrl;
    private String interests;
}
