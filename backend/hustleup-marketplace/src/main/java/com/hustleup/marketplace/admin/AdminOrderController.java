package com.hustleup.marketplace.admin;

import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.job.model.Job;
import com.hustleup.marketplace.job.repository.JobRepository;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin order tracking and support fixes.
 *
 * <p>Lives in {@code hustleup-marketplace} rather than beside the rest of the admin API in
 * {@code hustleup-auth} because orders are this service's data — bookings, listings and
 * jobs. The gateway stitches the two halves back together under one
 * {@code /api/v1/admin/**} prefix, so the console sees a single admin API.
 *
 * <p>Every method is {@code hasRole('ADMIN')}, doubled by the URL rule in
 * {@code CommonSecurityConfig}.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminOrderController {

    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;
    private final JobRepository jobRepository;
    private final UserRepository userRepository;

    /**
     * Order search.
     *
     * <p><b>GET /api/v1/admin/orders?status=&amp;q=</b>
     *
     * <p>Each row is enriched with the buyer, seller and listing title, because the support
     * question is always "what happened to Anna's order" and never "what happened to
     * booking 3e50e27f". Capped at 200 rows.
     */
    @GetMapping("/orders")
    public ResponseEntity<?> orders(@RequestParam(required = false) String status,
                                    @RequestParam(required = false) String q) {
        List<Booking> all = bookingRepository.findAll();

        BookingStatus wanted = null;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            try {
                wanted = BookingStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Unknown booking status: " + status));
            }
        }
        final BookingStatus statusFilter = wanted;
        final String needle = q == null ? "" : q.trim().toLowerCase();

        List<Map<String, Object>> rows = all.stream()
                .filter(b -> statusFilter == null || b.getStatus() == statusFilter)
                .sorted(Comparator.comparing(Booking::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::describe)
                .filter(m -> needle.isEmpty() || matches(m, needle))
                .limit(200)
                .collect(Collectors.toList());

        return ResponseEntity.ok(rows);
    }

    /**
     * Support override on an order.
     *
     * <p><b>PATCH /api/v1/admin/orders/{id}</b>
     * Body may carry {@code status}, {@code paymentStatus} and {@code note}.
     *
     * <p>This is the "fix stuff" lever: a payment that succeeded in Stripe but never
     * flipped the booking, a cancellation that stuck. It deliberately bypasses the state
     * machine in {@code BookingService} — that machine encodes what buyers and sellers may
     * do, and the whole reason support exists is to resolve situations those rules cannot.
     * Every override is logged with the acting admin.
     */
    @PatchMapping("/orders/{id}")
    public ResponseEntity<?> fixOrder(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null) return ResponseEntity.status(404).body(Map.of("error", "Order not found"));

        String before = booking.getStatus() + "/" + booking.getPaymentStatus();

        if (body.get("status") != null) {
            try {
                booking.setStatus(BookingStatus.valueOf(body.get("status").toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Unknown booking status"));
            }
        }
        if (body.get("paymentStatus") != null) {
            booking.setPaymentStatus(body.get("paymentStatus"));
        }
        if (body.get("note") != null) {
            booking.setCancelReason(body.get("note"));
        }
        booking.setUpdatedAt(LocalDateTime.now());
        Booking saved = bookingRepository.save(booking);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        log.warn("ADMIN ORDER OVERRIDE by {}: booking={} {} -> {}/{}",
                auth != null ? auth.getName() : "unknown", id, before,
                saved.getStatus(), saved.getPaymentStatus());

        return ResponseEntity.ok(describe(saved));
    }

    /**
     * Marketplace-side counters for the admin dashboard.
     *
     * <p><b>GET /api/v1/admin/marketplace-stats</b>
     */
    @GetMapping("/marketplace-stats")
    public ResponseEntity<?> stats() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalOrders", bookingRepository.count());
        out.put("totalListings", listingRepository.count());
        out.put("totalJobs", jobRepository.count());
        out.put("openJobs", jobRepository.countByStatus(Job.JobStatus.OPEN));

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (BookingStatus s : BookingStatus.values()) {
            byStatus.put(s.name(), bookingRepository.findAll().stream()
                    .filter(b -> b.getStatus() == s).count());
        }
        out.put("ordersByStatus", byStatus);
        return ResponseEntity.ok(out);
    }

    /**
     * Moderation view of every job advert, including closed and removed ones.
     *
     * <p><b>GET /api/v1/admin/jobs</b>
     */
    @GetMapping("/jobs")
    public ResponseEntity<?> jobs() {
        return ResponseEntity.ok(jobRepository.findAllByOrderByCreatedAtDesc().stream().map(j -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", j.getId());
            m.put("title", j.getTitle());
            m.put("companyName", j.getCompanyName());
            m.put("status", j.getStatus());
            m.put("applicationsCount", j.getApplicationsCount());
            m.put("viewsCount", j.getViewsCount());
            m.put("createdAt", j.getCreatedAt());
            m.put("publisherUserId", j.getPublisherUserId());
            return m;
        }).collect(Collectors.toList()));
    }

    // ---- Helpers ------------------------------------------------------------

    /** Flattens a booking plus its people and listing into one support-readable row. */
    private Map<String, Object> describe(Booking b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("status", b.getStatus());
        m.put("paymentStatus", b.getPaymentStatus());
        m.put("offeredPrice", b.getOfferedPrice());
        m.put("agreedPrice", b.getAgreedPrice());
        m.put("scheduledAt", b.getScheduledAt());
        m.put("createdAt", b.getCreatedAt());
        m.put("cancelReason", b.getCancelReason());
        m.put("paymentIntentId", b.getPaymentIntentId());

        userRepository.findById(b.getBuyerId()).ifPresent(u -> {
            m.put("buyerName", u.getFullName());
            m.put("buyerEmail", u.getEmail());
        });
        userRepository.findById(b.getSellerId()).ifPresent(u -> {
            m.put("sellerName", u.getFullName());
            m.put("sellerEmail", u.getEmail());
        });
        listingRepository.findById(b.getListingId()).ifPresent(l -> m.put("listingTitle", l.getTitle()));
        return m;
    }

    /** Free-text match across the fields a support agent would actually search by. */
    private boolean matches(Map<String, Object> row, String needle) {
        for (String key : List.of("buyerName", "buyerEmail", "sellerName", "sellerEmail",
                                  "listingTitle", "paymentIntentId", "id")) {
            Object v = row.get(key);
            if (v != null && v.toString().toLowerCase().contains(needle)) return true;
        }
        return false;
    }
}
