package com.hustleup.marketplace.trust;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.protection.model.ProtectionClaim;
import com.hustleup.marketplace.protection.repository.ProtectionClaimRepository;
import com.hustleup.marketplace.safety.SellerSafety;
import com.hustleup.marketplace.safety.SellerSafetyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin "Trust &amp; Safety" console API, under {@code /api/v1/admin/trust}: the listing review
 * queue, user reports, seller standing (strikes, links, suspensions) and the DAC7 export.
 * Suspension state and chargebacks live in {@code /api/v1/admin/safety} (SafetyAdminController).
 */
@RestController
@RequestMapping("/api/v1/admin/trust")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminTrustController {

    private final TrustService trust;
    private final Dac7Service dac7;
    private final MarketplaceReportRepository reports;
    private final SellerProfileRepository profiles;
    private final ListingRepository listings;
    private final UserRepository users;
    private final ProtectionClaimRepository claims;
    private final SellerSafetyRepository safety;
    private final FileStorageService storage;

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return Map.of(
                "listingsInReview", listings.countByStatus(ListingStatus.PENDING_REVIEW),
                "openReports", reports.countByStatus(MarketplaceReport.Status.OPEN),
                "openClaims", claims.findByStatusOrderByCreatedAtAsc(ProtectionClaim.ClaimStatus.OPEN).size(),
                "suspendedSellers", safety.findBySuspendedTrue().size(),
                "sellersWithStrikes", profiles.findByStrikesGreaterThanOrderByStrikesDesc(0).size());
    }

    // ── Listing review ─────────────────────────────────────────────────────────────────

    @GetMapping("/listings/review")
    public List<Map<String, Object>> reviewQueue() {
        List<Listing> queue = trust.reviewQueue();
        Map<UUID, User> sellers = byId(queue.stream().map(Listing::getSellerId).collect(Collectors.toSet()));
        return queue.stream().map(l -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", l.getId());
            m.put("title", l.getTitle());
            m.put("description", l.getDescription());
            m.put("price", l.getPrice());
            m.put("currency", l.getCurrency());
            m.put("image", firstImage(l.getMediaUrls()));
            m.put("reason", l.getReviewReason());
            m.put("createdAt", l.getCreatedAt());
            m.put("seller", person(sellers.get(l.getSellerId())));
            m.put("sellerStrikes", profiles.findById(l.getSellerId()).map(SellerProfile::getStrikes).orElse(0));
            return m;
        }).toList();
    }

    @PostMapping("/listings/{id}/approve")
    public Map<String, Object> approve(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) {
        Listing l = trust.approveListing(id, body == null ? null : body.get("note"));
        return Map.of("id", l.getId(), "status", l.getStatus());
    }

    @PostMapping("/listings/{id}/remove")
    public Map<String, Object> remove(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        Listing l = trust.removeListing(id, body.get("reason"));
        if (Boolean.parseBoolean(String.valueOf(body.getOrDefault("strike", "false")))) {
            trust.addStrike(l.getSellerId(), "Listing removed: " + body.get("reason"));
        }
        return Map.of("id", l.getId(), "status", l.getStatus());
    }

    // ── Reports ────────────────────────────────────────────────────────────────────────

    @GetMapping("/reports")
    public List<Map<String, Object>> reports(@RequestParam(defaultValue = "OPEN") String status) {
        List<MarketplaceReport> rows = "ALL".equalsIgnoreCase(status) ? reports.findAllByOrderByCreatedAtDesc()
                : reports.findByStatusOrderByCreatedAtAsc(TrustController.parse(MarketplaceReport.Status.class, status, "status"));
        Set<UUID> people = new HashSet<>();
        rows.forEach(r -> { people.add(r.getReporterId()); if (r.getSellerId() != null) people.add(r.getSellerId()); });
        Map<UUID, User> byId = byId(people);
        return rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("targetType", r.getTargetType());
            m.put("targetId", r.getTargetId());
            m.put("reason", r.getReason());
            m.put("detail", r.getDetail());
            m.put("status", r.getStatus());
            m.put("actionTaken", r.getActionTaken());
            m.put("resolutionNote", r.getResolutionNote());
            m.put("createdAt", r.getCreatedAt());
            m.put("reporter", person(byId.get(r.getReporterId())));
            m.put("seller", person(byId.get(r.getSellerId())));
            m.put("sellerOpenReports", r.getSellerId() == null ? 0 : reports.countBySellerIdAndStatus(r.getSellerId(), MarketplaceReport.Status.OPEN));
            if (r.getTargetType() == MarketplaceReport.TargetType.LISTING) {
                listings.findById(r.getTargetId()).ifPresent(l -> {
                    m.put("listingTitle", l.getTitle());
                    m.put("listingStatus", l.getStatus());
                    m.put("listingImage", firstImage(l.getMediaUrls()));
                    m.put("listingPrice", l.getPrice());
                    m.put("listingCurrency", l.getCurrency());
                });
            }
            return m;
        }).toList();
    }

    @PostMapping("/reports/{id}/resolve")
    public Map<String, Object> resolve(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        MarketplaceReport r = trust.resolveReport(id,
                TrustController.parse(TrustService.ReportAction.class, body.get("action"), "action"), body.get("note"));
        return Map.of("id", r.getId(), "status", r.getStatus(), "actionTaken", r.getActionTaken());
    }

    // ── Sellers ────────────────────────────────────────────────────────────────────────

    /** Sellers that need attention: suspended, with strikes, linked to a banned account, or reported. */
    @GetMapping("/sellers")
    public List<Map<String, Object>> sellers() {
        Map<UUID, Map<String, Object>> rows = new LinkedHashMap<>();
        for (SellerSafety s : safety.findBySuspendedTrue()) row(rows, s.getSellerId()).putAll(Map.of(
                "suspended", true, "suspensionReason", s.getReason() == null ? "" : s.getReason(),
                "suspendedAt", String.valueOf(s.getSuspendedAt())));
        for (SellerProfile p : profiles.findByStrikesGreaterThanOrderByStrikesDesc(0)) row(rows, p.getUserId());
        for (SellerProfile p : profiles.findAll()) if (p.getLinkedTo() != null) row(rows, p.getUserId());
        for (MarketplaceReport r : reports.findByStatusOrderByCreatedAtAsc(MarketplaceReport.Status.OPEN))
            if (r.getSellerId() != null) row(rows, r.getSellerId());
        Map<UUID, User> people = byId(rows.keySet());
        rows.forEach((id, m) -> {
            SellerProfile p = profiles.findById(id).orElse(null);
            m.put("seller", person(people.get(id)));
            m.putIfAbsent("suspended", false);
            m.put("strikes", p == null ? 0 : p.getStrikes());
            m.put("sellerType", p == null ? "PRIVATE" : p.getSellerType());
            m.put("linkedTo", p == null ? null : p.getLinkedTo());
            m.put("openReports", reports.countBySellerIdAndStatus(id, MarketplaceReport.Status.OPEN));
            m.put("upheldClaims", claims.findBySellerIdAndStatusIn(id, List.of(ProtectionClaim.ClaimStatus.REFUNDED)).size());
        });
        return new ArrayList<>(rows.values());
    }

    @PostMapping("/sellers/{id}/strike")
    public Map<String, Object> strike(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String reason = body.get("reason");
        if (reason == null || reason.isBlank()) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Give the reason the seller will see");
        SellerProfile p = trust.addStrike(id, reason);
        return Map.of("sellerId", id, "strikes", p.getStrikes());
    }

    /** Suspends the seller and any account sharing their payout bank account. */
    @PostMapping("/sellers/{id}/suspend")
    public Map<String, Object> suspend(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        trust.suspendSeller(id, body.get("reason"));
        return Map.of("sellerId", id, "suspended", true);
    }

    // ── DAC7 ───────────────────────────────────────────────────────────────────────────

    @GetMapping("/dac7")
    public List<Map<String, Object>> dac7(@RequestParam(required = false) Integer year) {
        int y = year == null ? LocalDate.now().getYear() - 1 : year;
        Map<UUID, User> people = byId(dac7.aggregate(y).keySet());
        return dac7.aggregate(y).values().stream().sorted(Comparator.comparing(Dac7Service.SellerYear::gross).reversed()).map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("seller", person(people.get(s.sellerId())));
            m.put("sales", s.sales());
            m.put("gross", s.gross());
            m.put("fees", s.fees());
            m.put("currency", s.currency());
            m.put("reportable", s.reportable());
            m.put("detailsComplete", s.detailsComplete());
            return m;
        }).toList();
    }

    @GetMapping(value = "/dac7.csv", produces = "text/csv")
    public ResponseEntity<String> dac7Csv(@RequestParam(required = false) Integer year,
                                          @RequestParam(defaultValue = "true") boolean onlyReportable) {
        int y = year == null ? LocalDate.now().getYear() - 1 : year;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"hustlespace-dac7-" + y + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .body(dac7.csv(y, onlyReportable));
    }

    // ── helpers ────────────────────────────────────────────────────────────────────────

    private static Map<String, Object> row(Map<UUID, Map<String, Object>> rows, UUID id) {
        return rows.computeIfAbsent(id, k -> new LinkedHashMap<>(Map.of("sellerId", k)));
    }

    private Map<UUID, User> byId(Collection<UUID> ids) {
        Set<UUID> clean = ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        return clean.isEmpty() ? Map.of() : users.findAllById(clean).stream().collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
    }

    private static Map<String, Object> person(User u) {
        if (u == null) return Map.of();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("name", u.displayName());
        m.put("email", u.getEmail());
        m.put("createdAt", u.getCreatedAt());
        return m;
    }

    private String firstImage(String mediaUrls) {
        if (mediaUrls == null || mediaUrls.isBlank()) return null;
        for (String raw : mediaUrls.split(",")) {
            String p = raw.trim();
            if (p.isEmpty() || p.toLowerCase().matches(".*\\.(mp4|mov|webm|m4v)(\\?.*)?$")) continue;
            try { return storage.refreshUrl(p); } catch (Exception e) { return null; }
        }
        return null;
    }
}
