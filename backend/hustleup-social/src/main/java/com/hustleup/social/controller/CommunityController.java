package com.hustleup.social.controller;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.social.dto.CommunityDto;
import com.hustleup.social.model.Community;
import com.hustleup.social.model.CommunityMember;
import com.hustleup.social.repository.CommunityMemberRepository;
import com.hustleup.social.repository.CommunityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Member-created communities: "Cars in Lublin", "Warsaw street food".
 *
 * <p>Anyone signed in can create one and anyone can join. What a community actually buys
 * you is a feed with a subject: {@code GET /api/v1/feed/communities} returns only posts
 * made into communities you belong to, so someone who joined a car group gets cars rather
 * than everything everyone posted today.
 *
 * <p>Posting into one is gated on membership, checked in
 * {@link FeedController#createPost} — a community you have not joined is not somewhere you
 * can put things.
 */
@RestController
@RequestMapping("/api/v1/communities")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final FileStorageService storageService;

    // -------------------------------------------------------------------------
    // Reads
    // -------------------------------------------------------------------------

    /**
     * Every community, busiest first.
     *
     * <p><b>GET /api/v1/communities</b> — public. Signed-in callers additionally get
     * {@code joinedByCurrentUser} on each row so the browse list can render Join/Joined
     * without a second call.
     */
    @GetMapping
    public ResponseEntity<List<CommunityDto>> browse() {
        List<Community> communities = communityRepository.findAllByOrderByMemberCountDescCreatedAtDesc();
        return ResponseEntity.ok(decorate(communities));
    }

    /** The communities the caller has joined. <b>GET /api/v1/communities/mine</b> */
    @GetMapping("/mine")
    public ResponseEntity<?> mine() {
        User me = currentUserOrNull();
        if (me == null) return ResponseEntity.status(401).build();
        List<String> ids = memberRepository.findByIdMemberId(me.getId().toString()).stream()
                .map(m -> m.getId().getCommunityId())
                .toList();
        if (ids.isEmpty()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(decorate(communityRepository.findByIdIn(ids)));
    }

    /** One community, by id or slug. <b>GET /api/v1/communities/{idOrSlug}</b> */
    @GetMapping("/{idOrSlug}")
    public ResponseEntity<?> getOne(@PathVariable String idOrSlug) {
        Community community = resolve(idOrSlug);
        if (community == null) return ResponseEntity.status(404).body(Map.of("error", "Community not found"));
        return ResponseEntity.ok(decorate(List.of(community)).get(0));
    }

    /** Members of one community. <b>GET /api/v1/communities/{idOrSlug}/members</b> */
    @GetMapping("/{idOrSlug}/members")
    public ResponseEntity<?> members(@PathVariable String idOrSlug) {
        Community community = resolve(idOrSlug);
        if (community == null) return ResponseEntity.status(404).body(Map.of("error", "Community not found"));

        List<CommunityMember> memberships = memberRepository.findByIdCommunityId(community.getId());
        Map<String, CommunityMember> byId = memberships.stream()
                .collect(Collectors.toMap(m -> m.getId().getMemberId(), m -> m, (a, b) -> a));

        List<UUID> uuids = byId.keySet().stream()
                .map(CommunityController::parseUuid)
                .filter(Objects::nonNull)
                .toList();

        return ResponseEntity.ok(userRepository.findAllById(uuids).stream()
                .map(u -> Map.of(
                        "id", u.getId().toString(),
                        "name", u.displayName(),
                        "avatarUrl", u.getAvatarUrl() == null ? "" : storageService.refreshUrl(u.getAvatarUrl()),
                        "role", byId.get(u.getId().toString()).getRole()))
                .toList());
    }

    // -------------------------------------------------------------------------
    // Writes
    // -------------------------------------------------------------------------

    /**
     * Creates a community and makes the caller its first member.
     *
     * <p><b>POST /api/v1/communities</b> — multipart, so a banner can be uploaded in the
     * same request rather than needing a second call before the community is usable.
     *
     * <p>The creator is joined here, not left to press Join afterwards: a community with
     * zero members would be invisible in a list sorted by membership, and its own creator
     * could not post into it.
     */
    @PostMapping(consumes = {"multipart/form-data", "application/x-www-form-urlencoded"})
    @Transactional
    public ResponseEntity<?> create(
            @RequestParam String name,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) MultipartFile image) {

        User me = currentUserOrNull();
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to create a community"));

        String cleanName = name == null ? "" : name.trim();
        if (cleanName.length() < 3) {
            return ResponseEntity.badRequest().body(Map.of("error", "A community needs a name of at least 3 characters"));
        }
        if (cleanName.length() > 80) cleanName = cleanName.substring(0, 80);

        Community community = Community.builder()
                .id(UUID.randomUUID().toString())
                .creatorId(me.getId().toString())
                .name(cleanName)
                .slug(uniqueSlug(cleanName))
                .description(trimToNull(description))
                .city(trimToNull(city))
                .category(trimToNull(category))
                .imageUrl(image != null && !image.isEmpty() ? storageService.store(image) : null)
                // The creator counts, and is added as a member immediately below.
                .memberCount(1)
                .build();

        Community saved = communityRepository.save(community);
        memberRepository.save(CommunityMember.builder()
                .id(new CommunityMember.Id(saved.getId(), me.getId().toString()))
                .role("OWNER")
                .build());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(CommunityDto.from(saved, true, true, storageService::refreshUrl));
    }

    /**
     * Joins a community. <b>POST /api/v1/communities/{idOrSlug}/join</b>
     *
     * <p>Idempotent: the membership's primary key is the (community, member) pair, so a
     * second tap rewrites the same row. The member count is recomputed from the membership
     * table rather than incremented, which keeps a double-tap from inflating it.
     */
    @PostMapping("/{idOrSlug}/join")
    @Transactional
    public ResponseEntity<?> join(@PathVariable String idOrSlug) {
        User me = currentUserOrNull();
        if (me == null) return ResponseEntity.status(401).body(Map.of("error", "Sign in to join"));
        Community community = resolve(idOrSlug);
        if (community == null) return ResponseEntity.status(404).body(Map.of("error", "Community not found"));

        memberRepository.save(CommunityMember.builder()
                .id(new CommunityMember.Id(community.getId(), me.getId().toString()))
                .role(community.getCreatorId().equals(me.getId().toString()) ? "OWNER" : "MEMBER")
                .build());
        community.setMemberCount((int) memberRepository.countByIdCommunityId(community.getId()));
        Community saved = communityRepository.save(community);

        return ResponseEntity.ok(CommunityDto.from(saved, true,
                saved.getCreatorId().equals(me.getId().toString()), storageService::refreshUrl));
    }

    /**
     * Leaves a community. <b>DELETE /api/v1/communities/{idOrSlug}/join</b>
     *
     * <p>The creator is refused rather than silently allowed: a community whose owner has
     * walked out has nobody answerable for it, and the honest options are to hand it over
     * or delete it — neither of which is "leave" quietly doing something else.
     */
    @DeleteMapping("/{idOrSlug}/join")
    @Transactional
    public ResponseEntity<?> leave(@PathVariable String idOrSlug) {
        User me = currentUserOrNull();
        if (me == null) return ResponseEntity.status(401).build();
        Community community = resolve(idOrSlug);
        if (community == null) return ResponseEntity.status(404).body(Map.of("error", "Community not found"));

        if (community.getCreatorId().equals(me.getId().toString())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "You created this community, so you can't leave it — delete it instead."));
        }

        memberRepository.deleteById(new CommunityMember.Id(community.getId(), me.getId().toString()));
        community.setMemberCount((int) memberRepository.countByIdCommunityId(community.getId()));
        Community saved = communityRepository.save(community);

        return ResponseEntity.ok(CommunityDto.from(saved, false, false, storageService::refreshUrl));
    }

    /**
     * Deletes a community. <b>DELETE /api/v1/communities/{idOrSlug}</b> — creator only.
     *
     * <p>Posts made into it are deliberately left alone. They belong to the people who
     * wrote them, and orphaning a member's post is not the community owner's call to make;
     * a post whose {@code communityId} no longer resolves simply reads as an ordinary post.
     */
    @DeleteMapping("/{idOrSlug}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable String idOrSlug) {
        User me = currentUserOrNull();
        if (me == null) return ResponseEntity.status(401).build();
        Community community = resolve(idOrSlug);
        if (community == null) return ResponseEntity.status(404).body(Map.of("error", "Community not found"));
        if (!community.getCreatorId().equals(me.getId().toString())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Only the creator can delete this community"));
        }

        memberRepository.deleteAll(memberRepository.findByIdCommunityId(community.getId()));
        communityRepository.delete(community);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Attaches the caller's membership flags to a batch of communities.
     *
     * <p>One query for the whole batch rather than an existence check per row — the browse
     * list is otherwise N+1 the moment it has more than a handful of communities on it.
     */
    private List<CommunityDto> decorate(List<Community> communities) {
        User me = currentUserOrNull();
        Set<String> joined = Set.of();
        String myId = null;
        if (me != null && !communities.isEmpty()) {
            myId = me.getId().toString();
            joined = memberRepository.findByIdMemberIdAndIdCommunityIdIn(
                            myId, communities.stream().map(Community::getId).toList())
                    .stream()
                    .map(m -> m.getId().getCommunityId())
                    .collect(Collectors.toSet());
        }
        final Set<String> joinedIds = joined;
        final String callerId = myId;
        return communities.stream()
                .map(c -> CommunityDto.from(c, joinedIds.contains(c.getId()),
                        callerId != null && callerId.equals(c.getCreatorId()),
                        storageService::refreshUrl))
                .toList();
    }

    /** Communities are addressable by UUID or by their readable slug. */
    private Community resolve(String idOrSlug) {
        return communityRepository.findById(idOrSlug)
                .or(() -> communityRepository.findBySlug(idOrSlug))
                .orElse(null);
    }

    /**
     * Builds a URL-safe slug, suffixing it until it is unique.
     *
     * <p>Two people naming a community "Cars in Lublin" is entirely likely, and the second
     * one should get {@code cars-in-lublin-2} rather than a constraint violation they
     * cannot interpret.
     */
    private String uniqueSlug(String name) {
        String base = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")           // strip accents: "Kraków" → "Krakow"
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "community";
        if (base.length() > 90) base = base.substring(0, 90);

        String candidate = base;
        int suffix = 2;
        while (communityRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix++;
        }
        return candidate;
    }

    private User currentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
