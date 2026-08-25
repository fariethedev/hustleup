package com.hustleup.notification.messaging.controller;

import com.hustleup.common.model.Match;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.push.ExpoPushService;
import com.hustleup.common.repository.MatchRepository;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.notification.messaging.model.DirectMessage;
import com.hustleup.notification.messaging.repository.ChatStreakRepository;
import com.hustleup.notification.messaging.repository.DirectMessageRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Covers the one thing {@code GET /partners} does that isn't simply "list who you've messaged":
 * it folds in Bond matches, including the ones nobody has said anything in yet.
 *
 * <p>Lenient strictness because the endpoint enriches every row with several independent
 * lookups (streaks, unread counts, last message) that individual tests don't all care about.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DirectMessageControllerTest {

    @Mock private DirectMessageRepository dmRepo;
    @Mock private UserRepository userRepo;
    @Mock private NotificationRepository notificationRepo;
    @Mock private FileStorageService fileStorageService;
    @Mock private ChatStreakRepository streakRepo;
    @Mock private ExpoPushService expoPushService;
    @Mock private MatchRepository matchRepo;

    @InjectMocks private DirectMessageController controller;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("A Bond match with no messages still appears in the conversation list")
    void getChatPartners_IncludesMatchesWithNoMessages() {
        User me = user("me@example.com", "Me");
        User match = user("match@example.com", "Match");
        LocalDateTime matchedAt = LocalDateTime.now().minusHours(2);

        authenticate(me);
        when(userRepo.findByEmail(me.getEmail())).thenReturn(Optional.of(me));
        when(userRepo.findById(match.getId())).thenReturn(Optional.of(match));
        // Nobody has ever messaged: without the match union this list would come back empty.
        when(dmRepo.findDistinctChatPartners(me.getId().toString())).thenReturn(List.of());
        when(dmRepo.findLastMessage(anyString(), anyString())).thenReturn(Optional.empty());
        when(matchRepo.findAllForUser(me.getId())).thenReturn(List.of(match(me, match, matchedAt)));

        List<Map<String, Object>> partners = partnersFrom(controller.getChatPartners());

        assertEquals(1, partners.size());
        assertEquals(match.getId().toString(), partners.get(0).get("id"));
        assertEquals(true, partners.get(0).get("isBondMatch"));
        assertEquals(true, partners.get(0).get("isNewMatch"));
        assertEquals(matchedAt.toString(), partners.get(0).get("matchedAt"));
        // No message means no preview — the client renders the match date instead.
        assertNull(partners.get(0).get("lastMessage"));
    }

    @Test
    @DisplayName("A match that has been messaged appears once, and is no longer a new match")
    void getChatPartners_DoesNotDuplicateAMatchThatHasBeenMessaged() {
        User me = user("me@example.com", "Me");
        User match = user("match@example.com", "Match");

        authenticate(me);
        when(userRepo.findByEmail(me.getEmail())).thenReturn(Optional.of(me));
        when(userRepo.findById(match.getId())).thenReturn(Optional.of(match));
        // The same person is both a message partner and a Bond match.
        when(dmRepo.findDistinctChatPartners(me.getId().toString()))
                .thenReturn(List.of(match.getId().toString()));
        when(dmRepo.findLastMessage(anyString(), anyString()))
                .thenReturn(Optional.of(message("hey")));
        when(matchRepo.findAllForUser(me.getId()))
                .thenReturn(List.of(match(me, match, LocalDateTime.now().minusDays(3))));

        List<Map<String, Object>> partners = partnersFrom(controller.getChatPartners());

        assertEquals(1, partners.size());
        assertEquals(true, partners.get(0).get("isBondMatch"));
        assertEquals(false, partners.get(0).get("isNewMatch"));
        assertEquals("hey", partners.get(0).get("lastMessage"));
    }

    @Test
    @DisplayName("Messaged conversations outrank unopened matches, newest match first among those")
    void getChatPartners_SortsMessagedConversationsAboveUnopenedMatches() {
        User me = user("me@example.com", "Me");
        User messaged = user("messaged@example.com", "Messaged");
        User oldMatch = user("old@example.com", "Old Match");
        User newMatch = user("new@example.com", "New Match");

        authenticate(me);
        when(userRepo.findByEmail(me.getEmail())).thenReturn(Optional.of(me));
        when(userRepo.findById(messaged.getId())).thenReturn(Optional.of(messaged));
        when(userRepo.findById(oldMatch.getId())).thenReturn(Optional.of(oldMatch));
        when(userRepo.findById(newMatch.getId())).thenReturn(Optional.of(newMatch));
        when(dmRepo.findDistinctChatPartners(me.getId().toString()))
                .thenReturn(List.of(messaged.getId().toString()));
        when(dmRepo.findLastMessage(anyString(), anyString())).thenReturn(Optional.empty());
        // Only the messaged conversation has a last message.
        when(dmRepo.findLastMessage(me.getId().toString(), messaged.getId().toString()))
                .thenReturn(Optional.of(message("yo")));
        when(matchRepo.findAllForUser(me.getId())).thenReturn(List.of(
                match(me, oldMatch, LocalDateTime.now().minusDays(9)),
                match(me, newMatch, LocalDateTime.now().minusMinutes(5))));

        List<Map<String, Object>> partners = partnersFrom(controller.getChatPartners());

        assertEquals(3, partners.size());
        assertEquals(messaged.getId().toString(), partners.get(0).get("id"));
        assertEquals(newMatch.getId().toString(), partners.get(1).get("id"));
        assertEquals(oldMatch.getId().toString(), partners.get(2).get("id"));
    }

    @Test
    @DisplayName("The bond-match check reports the date the two matched")
    void checkBondMatch_ReturnsTheMatchDate() {
        User me = user("me@example.com", "Me");
        User them = user("them@example.com", "Them");
        LocalDateTime matchedAt = LocalDateTime.now().minusDays(1);
        Match.Pair pair = Match.Pair.of(me.getId(), them.getId());

        authenticate(me);
        when(userRepo.findByEmail(me.getEmail())).thenReturn(Optional.of(me));
        when(matchRepo.existsByUserIdAAndUserIdB(pair.smaller(), pair.larger())).thenReturn(true);
        when(matchRepo.findAllForUser(me.getId())).thenReturn(List.of(match(me, them, matchedAt)));

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) controller.checkBondMatch(them.getId().toString()).getBody();

        assertNotNull(body);
        assertEquals(true, body.get("isBondMatch"));
        assertEquals(matchedAt.toString(), body.get("matchedAt"));
    }

    @Test
    @DisplayName("Two users who never matched report no match and no date")
    void checkBondMatch_ReportsNoMatch() {
        User me = user("me@example.com", "Me");
        UUID themId = UUID.randomUUID();

        authenticate(me);
        when(userRepo.findByEmail(me.getEmail())).thenReturn(Optional.of(me));
        when(matchRepo.existsByUserIdAAndUserIdB(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(false);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) controller.checkBondMatch(themId.toString()).getBody();

        assertNotNull(body);
        assertEquals(false, body.get("isBondMatch"));
        assertTrue(!body.containsKey("matchedAt"));
    }

    // ── Fixtures ─────────────────────────────────────────────────────────────

    private static void authenticate(User user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user.getEmail(), null, List.of())
        );
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> partnersFrom(ResponseEntity<?> response) {
        return (List<Map<String, Object>>) response.getBody();
    }

    private static Match match(User a, User b, LocalDateTime matchedAt) {
        Match.Pair pair = Match.Pair.of(a.getId(), b.getId());
        return Match.builder()
                .id(UUID.randomUUID())
                .userIdA(pair.smaller())
                .userIdB(pair.larger())
                .matchedAt(matchedAt)
                .build();
    }

    private static DirectMessage message(String content) {
        DirectMessage m = new DirectMessage();
        m.setContent(content);
        m.setMessageType("TEXT");
        m.setCreatedAt(LocalDateTime.now());
        return m;
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
}
