/**
 * REST API for Hustle Scores and the marketplace leaderboards.
 *
 * <p><b>Base path:</b> {@code /api/v1/leaderboard}
 *
 * <p>Reads are public. Rankings are social proof — they only work if a curious visitor who
 * has not signed up yet can see them.
 */
package com.hustleup.marketplace.reputation.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.reputation.dto.HustleScoreDto;
import com.hustleup.marketplace.reputation.dto.LeaderboardEntryDto;
import com.hustleup.marketplace.reputation.service.HustleScoreService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/leaderboard")
public class LeaderboardController {

    private final HustleScoreService hustleScoreService;
    private final UserRepository userRepository;

    public LeaderboardController(HustleScoreService hustleScoreService, UserRepository userRepository) {
        this.hustleScoreService = hustleScoreService;
        this.userRepository = userRepository;
    }

    /**
     * A ranked board.
     *
     * @param metric {@code sales} (default) | {@code earnings} | {@code score}
     * @param window {@code all} (default) | {@code week} | {@code month}
     */
    @GetMapping
    public ResponseEntity<List<LeaderboardEntryDto>> board(
            // Defaults to the composite Hustle Score, not a raw sales count. Ranking by sales
            // alone rewards volume and ignores whether any of it went well — a seller with
            // forty completed sales and a 2.1 rating would outrank one with twenty-five and a
            // 4.9. The score folds in sales, earnings, rating, review volume and swaps, each
            // capped so no single axis dominates, then decays with inactivity.
            @RequestParam(defaultValue = "score") String metric,
            @RequestParam(defaultValue = "all") String window,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(hustleScoreService.leaderboard(metric, window, limit));
    }

    /** The authenticated user's own score, including the points breakdown. */
    @GetMapping("/me")
    public ResponseEntity<HustleScoreDto> myScore() {
        return ResponseEntity.ok(hustleScoreService.scoreFor(requireCurrentUser().getId()));
    }

    /** Any user's score — used for the badge on a public profile. */
    @GetMapping("/user/{userId}")
    public ResponseEntity<HustleScoreDto> scoreFor(@PathVariable UUID userId) {
        return ResponseEntity.ok(hustleScoreService.scoreFor(userId));
    }

    private User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("Not authenticated");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found: " + authentication.getName()));
    }
}
