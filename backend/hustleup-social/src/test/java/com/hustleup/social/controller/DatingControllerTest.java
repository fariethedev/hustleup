package com.hustleup.social.controller;

import com.hustleup.common.model.Notification;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.MatchRepository;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.subscription.PremiumAccess;
import com.hustleup.social.model.DatingProfile;
import com.hustleup.social.model.DatingSwipe;
import com.hustleup.social.repository.DatingProfileRepository;
import com.hustleup.social.repository.DatingSwipeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DatingControllerTest {

    @Mock
    private DatingProfileRepository datingProfileRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private DatingSwipeRepository datingSwipeRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private MatchRepository matchRepository;

    /**
     * Bond is Premium-only, and the controller now checks that itself rather than trusting the
     * browser. Without this mock the constructor injection would hand the controller a null and
     * every test here would die inside the gate.
     */
    @Mock
    private PremiumAccess premiumAccess;

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

        authenticate(currentUser);

        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        discoverable(femaleUser, maleUser);
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(currentProfile, femaleProfile, maleProfile));
        when(datingSwipeRepository.findBySwiperId(currentUser.getId())).thenReturn(List.of());

        List<DatingProfile> profiles = profilesOf(datingController.getProfiles());

        assertEquals(1, profiles.size());
        assertEquals("Female", profiles.get(0).getGender());
        assertEquals(femaleUser.getId(), profiles.get(0).getId());
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

        authenticate(currentUser);

        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        discoverable(femaleUser, maleUser);
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(currentProfile, femaleProfile, maleProfile));
        when(datingSwipeRepository.findBySwiperId(currentUser.getId())).thenReturn(List.of());

        List<DatingProfile> profiles = profilesOf(datingController.getProfiles());

        assertEquals(1, profiles.size());
        assertEquals("Male", profiles.get(0).getGender());
        assertEquals(maleUser.getId(), profiles.get(0).getId());
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

        authenticate(currentUser);

        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        discoverable(femaleUser, maleUser, noProfileUser);
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser, noProfileUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(currentProfile, femaleProfile, maleProfile));
        when(datingSwipeRepository.findBySwiperId(currentUser.getId())).thenReturn(List.of());

        List<DatingProfile> profiles = profilesOf(datingController.getProfiles());

        assertNotNull(profiles);
        assertEquals(3, profiles.size());
    }

    @Test
    @DisplayName("An explicit \"Everyone\" preference overrides the opposite-gender fallback")
    void getProfiles_ShowMeEveryoneDisablesGenderFiltering() {
        User currentUser = user("male@example.com", "Male User");
        User femaleUser = user("female@example.com", "Female User");
        User maleUser = user("other-male@example.com", "Other Male");

        DatingProfile currentProfile = profile(currentUser.getId(), "Male User", "Male");
        currentProfile.setShowMe("Everyone");

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        discoverable(femaleUser, maleUser);
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(
                currentProfile,
                profile(femaleUser.getId(), "Female User", "Female"),
                profile(maleUser.getId(), "Other Male", "Male")));
        when(datingSwipeRepository.findBySwiperId(currentUser.getId())).thenReturn(List.of());

        List<DatingProfile> profiles = profilesOf(datingController.getProfiles());

        assertNotNull(profiles);
        assertEquals(2, profiles.size());
    }

    @Test
    @DisplayName("A \"Women\" preference is taken literally, including for profiles with no stated gender")
    void getProfiles_ShowMeWomenExcludesUnstatedGenders() {
        User currentUser = user("me@example.com", "Me");
        User femaleUser = user("female@example.com", "Female User");
        User maleUser = user("male@example.com", "Male User");
        User noProfileUser = user("noprof@example.com", "No Profile");

        DatingProfile currentProfile = profile(currentUser.getId(), "Me", "Female");
        currentProfile.setShowMe("Women");

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        discoverable(femaleUser, maleUser, noProfileUser);
        when(userRepository.findAll()).thenReturn(List.of(currentUser, femaleUser, maleUser, noProfileUser));
        when(datingProfileRepository.findAll()).thenReturn(List.of(
                currentProfile,
                profile(femaleUser.getId(), "Female User", "Female"),
                profile(maleUser.getId(), "Male User", "Male")));
        when(datingSwipeRepository.findBySwiperId(currentUser.getId())).thenReturn(List.of());

        List<DatingProfile> profiles = profilesOf(datingController.getProfiles());

        assertNotNull(profiles);
        assertEquals(1, profiles.size());
        assertEquals(femaleUser.getId(), profiles.get(0).getId());
    }

    @Test
    @DisplayName("Profiles that already liked you are badged and dealt to the front of the deck")
    void getProfiles_AdmirersAreBadgedAndSortedFirst() {
        User currentUser = user("me@example.com", "Me");
        User plainUser = user("plain@example.com", "Plain");
        User admirer = user("admirer@example.com", "Admirer");

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        // Deliberately behind the other candidate in the source order — the badge is what
        // should move it to the front, not the order the users came back in.
        discoverable(plainUser, admirer);
        when(userRepository.findAll()).thenReturn(List.of(currentUser, plainUser, admirer));
        when(datingProfileRepository.findAll()).thenReturn(List.of());
        when(datingSwipeRepository.findBySwiperId(currentUser.getId())).thenReturn(List.of());
        when(datingSwipeRepository.findByTargetIdAndActionIn(eq(currentUser.getId()), anyCollection()))
                .thenReturn(List.of(swipe(admirer.getId(), currentUser.getId(), "SUPER_LIKE")));

        List<DatingProfile> profiles = profilesOf(datingController.getProfiles());

        assertNotNull(profiles);
        assertEquals(2, profiles.size());
        assertEquals(admirer.getId(), profiles.get(0).getId());
        assertTrue(profiles.get(0).getLikedYou());
        assertFalse(profiles.get(1).getLikedYou());
    }

    @Test
    @DisplayName("A super like notifies the recipient even when the like isn't mutual")
    void likeProfile_SuperLikeNotifiesTheRecipientImmediately() {
        User currentUser = user("me@example.com", "Me");
        UUID targetId = UUID.randomUUID();

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(datingSwipeRepository.findBySwiperIdAndTargetId(currentUser.getId(), targetId))
                .thenReturn(Optional.empty());
        when(datingSwipeRepository.existsBySwiperIdAndTargetIdAndActionIn(
                eq(targetId), eq(currentUser.getId()), anyCollection())).thenReturn(false);

        datingController.likeProfile(targetId, true);

        ArgumentCaptor<DatingSwipe> swipe = ArgumentCaptor.forClass(DatingSwipe.class);
        verify(datingSwipeRepository).save(swipe.capture());
        assertEquals("SUPER_LIKE", swipe.getValue().getAction());

        ArgumentCaptor<Notification> notification = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notification.capture());
        assertEquals(targetId, notification.getValue().getUserId());
        assertEquals("DATING_SUPER_LIKE", notification.getValue().getNotificationType());
    }

    @Test
    @DisplayName("An ordinary like stays private until it turns out to be mutual")
    void likeProfile_PlainLikeNotifiesNobody() {
        User currentUser = user("me@example.com", "Me");
        UUID targetId = UUID.randomUUID();

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(datingSwipeRepository.findBySwiperIdAndTargetId(currentUser.getId(), targetId))
                .thenReturn(Optional.empty());
        when(datingSwipeRepository.existsBySwiperIdAndTargetIdAndActionIn(
                eq(targetId), eq(currentUser.getId()), anyCollection())).thenReturn(false);

        datingController.likeProfile(targetId, false);

        ArgumentCaptor<DatingSwipe> swipe = ArgumentCaptor.forClass(DatingSwipe.class);
        verify(datingSwipeRepository).save(swipe.capture());
        assertEquals("LIKE", swipe.getValue().getAction());
        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    @DisplayName("Rewind deletes the last swipe and hands the profile back to the deck")
    void rewind_RestoresTheLastSwipedProfile() {
        User currentUser = user("me@example.com", "Me");
        User target = user("target@example.com", "Target");
        DatingSwipe lastSwipe = swipe(currentUser.getId(), target.getId(), "PASS");

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(datingSwipeRepository.findFirstBySwiperIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(Optional.of(lastSwipe));
        when(matchRepository.existsByUserIdAAndUserIdB(any(UUID.class), any(UUID.class))).thenReturn(false);
        when(userRepository.findById(target.getId())).thenReturn(Optional.of(target));
        when(datingProfileRepository.findById(target.getId())).thenReturn(Optional.empty());

        Map<String, Object> body = bodyOf(datingController.rewind());

        verify(datingSwipeRepository).delete(lastSwipe);
        assertEquals(true, body.get("rewound"));
        assertEquals(target.getId(), ((DatingProfile) body.get("profile")).getId());
    }

    @Test
    @DisplayName("A swipe that already produced a match cannot be rewound")
    void rewind_RefusesToUndoASwipeThatMatched() {
        User currentUser = user("me@example.com", "Me");
        User target = user("target@example.com", "Target");
        DatingSwipe lastSwipe = swipe(currentUser.getId(), target.getId(), "LIKE");

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(datingSwipeRepository.findFirstBySwiperIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(Optional.of(lastSwipe));
        when(matchRepository.existsByUserIdAAndUserIdB(any(UUID.class), any(UUID.class))).thenReturn(true);

        Map<String, Object> body = bodyOf(datingController.rewind());

        verify(datingSwipeRepository, never()).delete(any(DatingSwipe.class));
        assertEquals(false, body.get("rewound"));
        assertEquals("matched", body.get("reason"));
    }

    @Test
    @DisplayName("Rewinding with nothing to undo reports it rather than failing")
    void rewind_ReportsAnEmptySwipeHistory() {
        User currentUser = user("me@example.com", "Me");

        authenticate(currentUser);
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(datingSwipeRepository.findFirstBySwiperIdOrderByCreatedAtDesc(currentUser.getId()))
                .thenReturn(Optional.empty());

        Map<String, Object> body = bodyOf(datingController.rewind());

        assertEquals(false, body.get("rewound"));
        assertEquals("empty", body.get("reason"));
    }

    @Test
    @DisplayName("Discovery is refused to an account without Premium")
    void getProfiles_WithoutPremiumIsRefused() {
        User currentUser = user("free@example.com", "Free User");

        // Signed in by hand rather than through authenticate(), which grants Premium — the
        // absence of it is the whole point of this test.
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(currentUser.getEmail(), null, List.of())
        );
        when(userRepository.findByEmail(currentUser.getEmail())).thenReturn(Optional.of(currentUser));
        when(premiumAccess.isPremium(currentUser.getId())).thenReturn(false);

        ResponseEntity<?> response = datingController.getProfiles();

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals("PREMIUM_REQUIRED", bodyOf(response).get("code"));
        // The refusal has to come before the work, not after it — a gate that still assembles
        // the deck and then declines to return it is leaking the query, not the data.
        verify(datingProfileRepository, never()).findAll();
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    /**
     * Signs {@code user} in and gives them Premium.
     *
     * <p>Every Bond endpoint exercised below is gated on Premium, so without the second half
     * of this each test would be asserting against a 403 body. The refusal path is covered
     * separately by {@link #getProfiles_WithoutPremiumIsRefused()}.
     */
    private void authenticate(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of())
        );
        when(premiumAccess.isPremium(user.getId())).thenReturn(true);
    }

    /**
     * Declares which accounts hold Premium, and so may appear in the deck at all.
     *
     * <p>Discovery is paying-members-only: a free account that fills in a profile no longer
     * sits in every subscriber's stack collecting likes. Nothing reaches the deck without
     * being named here, so every discovery test has to say who is paying — which is also what
     * makes the rule visible in the tests rather than implied.
     */
    private void discoverable(User... users) {
        when(premiumAccess.allPremiumUserIds())
                .thenReturn(Arrays.stream(users).map(User::getId).collect(Collectors.toSet()));
    }

    @SuppressWarnings("unchecked")
    private static List<DatingProfile> profilesOf(ResponseEntity<?> response) {
        return (List<DatingProfile>) response.getBody();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> bodyOf(ResponseEntity<?> response) {
        return (Map<String, Object>) response.getBody();
    }

    private static DatingSwipe swipe(UUID swiperId, UUID targetId, String action) {
        return DatingSwipe.builder()
                .id(UUID.randomUUID())
                .swiperId(swiperId)
                .targetId(targetId)
                .action(action)
                .build();
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
