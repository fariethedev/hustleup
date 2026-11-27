package com.hustleup.marketplace.trust;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * User-facing trust endpoints:
 * <ul>
 *   <li>{@code POST /api/v1/listings/report} — report a listing, shop or seller;</li>
 *   <li>{@code GET  /api/v1/listings/traders/{userId}} — public trader details of a business
 *       seller (DSA: buyers must be able to see who a business is);</li>
 *   <li>{@code GET/PUT /api/v1/payouts/seller-profile} — the seller's own legal details and
 *       DAC7 status for the current year.</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
public class TrustController {

    private final TrustService trust;
    private final SellerProfileRepository profiles;
    private final Dac7Service dac7;
    private final UserRepository users;

    @PostMapping("/api/v1/listings/report")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> report(@RequestBody Map<String, String> body) {
        MarketplaceReport.TargetType type = parse(MarketplaceReport.TargetType.class, body.get("targetType"), "targetType");
        MarketplaceReport.Reason reason = parse(MarketplaceReport.Reason.class, body.get("reason"), "reason");
        UUID targetId;
        try { targetId = UUID.fromString(String.valueOf(body.get("targetId")).trim()); }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetId must be a UUID"); }
        MarketplaceReport r = trust.report(type, targetId, reason, body.get("detail"));
        return ResponseEntity.ok(Map.of("id", r.getId(), "status", r.getStatus(),
                "message", "Thanks — our team will review this. You will be told the outcome."));
    }

    @GetMapping("/api/v1/listings/traders/{userId}")
    public ResponseEntity<?> trader(@PathVariable UUID userId) {
        SellerProfile p = profiles.findById(userId).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        boolean business = p != null && p.getSellerType() == SellerProfile.SellerType.BUSINESS;
        out.put("sellerType", business ? "BUSINESS" : "PRIVATE");
        if (business) {
            out.put("businessName", p.getBusinessName());
            out.put("registrationNo", p.getRegistrationNo());
            out.put("vatNumber", p.getVatNumber());
            out.put("address", String.join(", ", java.util.stream.Stream.of(p.getAddressLine1(), p.getPostalCode(), p.getCity(), p.getCountry())
                    .filter(s -> s != null && !s.isBlank()).toList()));
            out.put("contactEmail", p.getContactEmail());
            out.put("consumerRights", "Business seller: EU consumer law applies, including a 14-day right of withdrawal for distance purchases.");
        } else {
            out.put("consumerRights", "Private seller: EU consumer rights (such as the 14-day withdrawal right) do not apply. HustleSpace buyer protection still covers items that do not arrive or are not as described.");
        }
        return ResponseEntity.ok(out);
    }

    @GetMapping("/api/v1/payouts/seller-profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> myProfile() {
        User me = me();
        return ResponseEntity.ok(view(trust.profile(me.getId()), me.getId()));
    }

    @PutMapping("/api/v1/payouts/seller-profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> saveProfile(@RequestBody Map<String, String> body) {
        User me = me();
        SellerProfile p = trust.profile(me.getId());
        if (body.containsKey("sellerType")) p.setSellerType(parse(SellerProfile.SellerType.class, body.get("sellerType"), "sellerType"));
        p.setLegalName(clean(body, "legalName", p.getLegalName(), 200));
        p.setBusinessName(clean(body, "businessName", p.getBusinessName(), 200));
        p.setTaxId(clean(body, "taxId", p.getTaxId(), 40));
        p.setVatNumber(clean(body, "vatNumber", p.getVatNumber(), 40));
        p.setRegistrationNo(clean(body, "registrationNo", p.getRegistrationNo(), 60));
        p.setAddressLine1(clean(body, "addressLine1", p.getAddressLine1(), 200));
        p.setCity(clean(body, "city", p.getCity(), 100));
        p.setPostalCode(clean(body, "postalCode", p.getPostalCode(), 20));
        String country = clean(body, "country", p.getCountry(), 2);
        p.setCountry(country == null ? null : country.toUpperCase(Locale.ROOT));
        p.setContactEmail(clean(body, "contactEmail", p.getContactEmail(), 200));
        p.setContactPhone(clean(body, "contactPhone", p.getContactPhone(), 40));
        if (body.containsKey("dateOfBirth")) {
            String dob = body.get("dateOfBirth");
            try {
                LocalDate d = dob == null || dob.isBlank() ? null : LocalDate.parse(dob.trim());
                if (d != null && d.isAfter(LocalDate.now().minusYears(13)))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check the date of birth");
                p.setDateOfBirth(d);
            } catch (java.time.format.DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date of birth must be YYYY-MM-DD");
            }
        }
        if (p.getTaxId() != null && !p.getTaxId().matches("[A-Za-z0-9 \\-/]{4,40}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check the tax ID — letters, digits and dashes only");
        p.setUpdatedAt(LocalDateTime.now());
        profiles.save(p);
        return ResponseEntity.ok(view(p, me.getId()));
    }

    private Map<String, Object> view(SellerProfile p, UUID userId) {
        Dac7Service.SellerYear year = dac7.forSeller(userId, LocalDate.now().getYear());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sellerType", p.getSellerType());
        out.put("legalName", p.getLegalName());
        out.put("businessName", p.getBusinessName());
        out.put("taxId", p.getTaxId());
        out.put("vatNumber", p.getVatNumber());
        out.put("registrationNo", p.getRegistrationNo());
        out.put("dateOfBirth", p.getDateOfBirth());
        out.put("addressLine1", p.getAddressLine1());
        out.put("city", p.getCity());
        out.put("postalCode", p.getPostalCode());
        out.put("country", p.getCountry());
        out.put("contactEmail", p.getContactEmail());
        out.put("contactPhone", p.getContactPhone());
        out.put("traderDetailsComplete", p.traderDetailsComplete());
        out.put("taxDetailsComplete", p.taxDetailsComplete());
        out.put("strikes", p.getStrikes());
        out.put("strikeLimit", TrustService.STRIKE_LIMIT);
        out.put("salesThisYear", year.sales());
        out.put("grossThisYear", year.gross());
        out.put("taxReportingRequired", year.reportable());
        return out;
    }

    private User me() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return users.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private static String clean(Map<String, String> body, String key, String current, int max) {
        if (!body.containsKey(key)) return current;
        String v = body.get(key);
        if (v == null || v.isBlank()) return null;
        v = v.trim();
        if (v.length() > max) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is too long");
        return v;
    }

    static <E extends Enum<E>> E parse(Class<E> type, String raw, String field) {
        if (raw == null || raw.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        try { return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be one of " + java.util.Arrays.toString(type.getEnumConstants()));
        }
    }
}
