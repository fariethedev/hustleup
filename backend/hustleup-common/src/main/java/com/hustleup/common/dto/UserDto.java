package com.hustleup.common.dto;

import lombok.*;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDto {
    private UUID id;
    private String email;
    private String fullName;
    private String role;
    private String avatarUrl;

    public static UserDto fromEntity(Object user) {
        // We use Object to avoid circular dependency in common module, 
        // or we should have a more generic approach.
        // For now, I'll just use a manual mapping in the services themselves 
        // or use a generic builder.
        return new UserDto();
    }
}
