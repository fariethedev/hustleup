package com.hustleup.social.controller;

import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.social.model.DatingProfile;
import com.hustleup.social.repository.DatingProfileRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DatingControllerTest {

    @Mock
    private DatingProfileRepository datingProfileRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @InjectMocks
    private DatingController datingController;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Male users only receive female profiles")
    void getProfiles_MaleUserOnlySeesFemaleProfiles() {
        User currentUser = user("male@example.com", "Male User");
        User femaleUser = user("female@example.com", "Female User");
        User maleUser = user("other-male@example.com", "Other Male");

        DatingProfile currentProfile = profile(currentUser.getId(), "Male User", "Male");
        DatingProfile femaleProfile = profile(femaleUser.getId(), "Female User", "Female");
        DatingProfile maleProfile = profile(maleUser.getId(), "Other Male", "Male");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(currentUser.getEmail(), null, List.of())
        );

        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(currentProfile, femaleProfile, maleProfile));

        ResponseEntity<List<DatingProfile>> response = datingController.getProfiles();

        assertEquals(1, response.getBody().size());
        assertEquals("Female", response.getBody().get(0).getGender());
        assertEquals(femaleUser.getId(), response.getBody().get(0).getId());
    }

    @Test
    @DisplayName("Female users only receive male profiles")
    void getProfiles_FemaleUserOnlySeesMaleProfiles() {
        User currentUser = user("female@example.com", "Female User");
        User femaleUser = user("other-female@example.com", "Other Female");
        User maleUser = user("male@example.com", "Male User");

        DatingProfile currentProfile = profile(currentUser.getId(), "Female User", "Female");
        DatingProfile femaleProfile = profile(femaleUser.getId(), "Other Female", "Female");
        DatingProfile maleProfile = profile(maleUser.getId(), "Male User", "Male");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(currentUser.getEmail(), null, List.of())
        );

        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(currentProfile, femaleProfile, maleProfile));

        ResponseEntity<List<DatingProfile>> response = datingController.getProfiles();

        assertEquals(1, response.getBody().size());
        assertEquals("Male", response.getBody().get(0).getGender());
        assertEquals(maleUser.getId(), response.getBody().get(0).getId());
    }

    @Test
    @DisplayName("Users without a male or female gender keep the existing unfiltered discovery list")
    void getProfiles_UnspecifiedGenderKeepsDiscoveryListUnfiltered() {
        User currentUser = user("unknown@example.com", "Unknown User");
        User femaleUser = user("female@example.com", "Female User");
        User maleUser = user("male@example.com", "Male User");
        User noProfileUser = user("noprof@example.com", "No Profile");

        DatingProfile currentProfile = profile(currentUser.getId(), "Unknown User", "Non-binary");
        DatingProfile femaleProfile = profile(femaleUser.getId(), "Female User", "Female");
        DatingProfile maleProfile = profile(maleUser.getId(), "Male User", "Male");

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(currentUser.getEmail(), null, List.of())
        );

        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser, noProfileUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(currentProfile, femaleProfile, maleProfile));

        ResponseEntity<List<DatingProfile>> response = datingController.getProfiles();

        List<DatingProfile> profiles = response.getBody();
        assertNotNull(profiles);
        assertEquals(3, profiles.size());
    }

    private static User user(String email, String fullName) {
        return User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .password("hashed")
                .fullName(fullName)
                .role(Role.BUYER)
                .build();
    }

    private static DatingProfile profile(UUID id, String fullName, String gender) {
        return DatingProfile.builder()
                .id(id)
                .fullName(fullName)
                .gender(gender)
                .age(25)
                .lookingFor("Dating")
                .build();
    }
}
