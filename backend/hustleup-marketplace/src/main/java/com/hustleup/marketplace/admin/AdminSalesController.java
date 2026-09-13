package com.hustleup.marketplace.admin;

import com.hustleup.common.model.Subscription;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.SubscriptionRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.subscription.PremiumAccess;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Everything sold through the app, for the admin console.
 *
 * <h2>Two different numbers, deliberately never added together</h2>
 * <p>The platform takes no commission on anything — there is no fee, no cut, no application
 * fee anywhere in the payment path. So the money flowing <em>through</em> HustleSpace and the
 * money HustleSpace <em>earns</em> are unrelated quantities, and a single "sales" total
 * combining them would overstate income by whatever the marketplace happens to turn over:
 * <ul>
 *   <li><b>GMV</b> — bookings and storefront orders. Buyers paying sellers. None of it ours.</li>
 *   <li><b>Platform revenue</b> — Premium subscriptions. The only money the business takes.</li>
 * </ul>
 * They are reported as separate objects for that reason, not as a presentational choice.
 *
 * <h2>Why subscription revenue is a run rate and not a history</h2>
 * <p>There is no payment ledger. A {@code Subscription} is one mutable row per account:
 * renewing overwrites {@code expiresAt} and leaves {@code startedAt} at the first activation,
 * so a second, third or tenth payment leaves no trace behind it. Historical subscription
 * revenue is therefore not reconstructable from the data that exists — not a query nobody has
 * written yet, but a record that was never kept.
 *
 * <p>What can be said honestly is said: how many accounts are subscribed now, what that is
 * worth per month, and how many of them started within the window. Anything framed as
 * "subscription revenue last month" would be a guess with a currency symbol on it. A real
 * history needs an append-only row per payment, written where Stripe is confirmed.
 *
 * <h2>Currency</h2>
 * <p>Every total is a map keyed by currency rather than one summed figure. There is no
 * conversion on the server and no rate table to do it with; the frontend's rates are marked
 * indicative and exist to help a shopper compare listings, which is not a standard to report
 * revenue against. Summing PLN and EUR into one number here would invent an exchange rate and
 * then hide it inside a total nobody could check.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminSalesController {

    /** Booking payment states where money actually moved. */
    private static final Set<String> BOOKING_PAID = Set.of("PAID", "TRANSFERRED");

    /** Storefront order states where money actually moved. */
    private static final Set<ShopOrder.ShopOrderStatus> SHOP_PAID =
            Set.of(ShopOrder.ShopOrderStatus.PAID, ShopOrder.ShopOrderStatus.FULFILLED);

    /** Keeps one over-wide request from building a series with thousands of buckets. */
    private static final int MAX_WINDOW_DAYS = 365;

    private final BookingRepository bookingRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final UserRepository userRepository;

    /**
     * <b>GET /api/v1/admin/sales?days=30</b>
     *
     * <p>Window applies to GMV and the daily series. Lifetime totals and the subscriber
     * figures ignore it — "what has this app ever sold" is a different question from "what
     * did it sell this month", and the console shows both.
     */
    @GetMapping("/sales")
    public ResponseEntity<?> sales(@RequestParam(required = false, defaultValue = "30") int days) {
        int window = Math.max(1, Math.min(days, MAX_WINDOW_DAYS));
        LocalDateTime since = LocalDate.now().minusDays(window - 1L).atStartOfDay();

        List<Booking> bookings = bookingRepository.findAll();
        List<ShopOrder> orders = shopOrderRepository.findAll();

        List<Booking> paidBookings = bookings.stream().filter(this::isPaid).toList();
        List<ShopOrder> paidOrders = orders.stream()
                .filter(o -> SHOP_PAID.contains(o.getStatus())).toList();

        List<Booking> windowBookings = paidBookings.stream()
                .filter(b -> after(b.getCreatedAt(), since)).toList();
        List<ShopOrder> windowOrders = paidOrders.stream()
                .filter(o -> after(o.getCreatedAt(), since)).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("windowDays", window);
        out.put("since", since);

        // ── GMV, in the window ────────────────────────────────────────────────
        Map<String, BigDecimal> bookingTotals = totalBy(windowBookings, this::bookingAmount, Booking::getCurrency);
        Map<String, BigDecimal> orderTotals = totalBy(windowOrders, ShopOrder::getTotalPrice, ShopOrder::getCurrency);

        Map<String, Object> gmv = new LinkedHashMap<>();
        gmv.put("bookings", Map.of("count", windowBookings.size(), "totals", bookingTotals));
        gmv.put("shopOrders", Map.of("count", windowOrders.size(), "totals", orderTotals));
        gmv.put("totals", merge(bookingTotals, orderTotals));
        gmv.put("count", windowBookings.size() + windowOrders.size());
        out.put("gmv", gmv);

        // ── GMV, all time ─────────────────────────────────────────────────────
        Map<String, BigDecimal> lifeBookings = totalBy(paidBookings, this::bookingAmount, Booking::getCurrency);
        Map<String, BigDecimal> lifeOrders = totalBy(paidOrders, ShopOrder::getTotalPrice, ShopOrder::getCurrency);
        Map<String, Object> lifetime = new LinkedHashMap<>();
        lifetime.put("bookings", Map.of("count", paidBookings.size(), "totals", lifeBookings));
        lifetime.put("shopOrders", Map.of("count", paidOrders.size(), "totals", lifeOrders));
        lifetime.put("totals", merge(lifeBookings, lifeOrders));
        lifetime.put("count", paidBookings.size() + paidOrders.size());
        out.put("lifetimeGmv", lifetime);

        // ── Money that went back out ──────────────────────────────────────────
        // Refunds are reported rather than quietly netted off: "we turned over X and refunded
        // Y of it" is the useful shape, and a net figure hides Y entirely.
        List<Booking> refundedBookings = bookings.stream()
                .filter(b -> "REFUNDED".equalsIgnoreCase(b.getPaymentStatus())).toList();
        List<ShopOrder> refundedOrders = orders.stream()
                .filter(o -> o.getStatus() == ShopOrder.ShopOrderStatus.REFUNDED).toList();
        Map<String, Object> refunds = new LinkedHashMap<>();
        refunds.put("count", refundedBookings.size() + refundedOrders.size());
        refunds.put("totals", merge(
                totalBy(refundedBookings, this::bookingAmount, Booking::getCurrency),
                totalBy(refundedOrders, ShopOrder::getTotalPrice, ShopOrder::getCurrency)));
        out.put("refunds", refunds);

        // ── Platform revenue ──────────────────────────────────────────────────
        out.put("platform", platform(since));

        // ── Daily series, for the chart ───────────────────────────────────────
        out.put("series", series(windowBookings, windowOrders, since, window));

        // ── Who is actually selling ───────────────────────────────────────────
        out.put("topSellers", topSellers(windowBookings, windowOrders));

        return ResponseEntity.ok(out);
    }

    // ---- Platform revenue ---------------------------------------------------

    /**
     * What the business itself earns.
     *
     * <p>See the class note: this is a run rate plus a count of new starts, because the
     * subscription table keeps no per-payment history to total up.
     */
    private Map<String, Object> platform(LocalDateTime since) {
        List<Subscription> active = subscriptionRepository
                .findByPlanAndStatus(PremiumAccess.PREMIUM_PLAN, "ACTIVE").stream()
                .filter(PremiumAccess::isActivePremium)
                .toList();

        Map<String, BigDecimal> runRate = new TreeMap<>();
        for (Subscription s : active) {
            if (s.getPricePerMonth() == null) continue;
            runRate.merge(currencyOf(s.getCurrency()), s.getPricePerMonth(), BigDecimal::add);
        }

        long started = active.stream()
                .filter(s -> after(s.getStartedAt(), since))
                .count();

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activeSubscribers", active.size());
        m.put("newSubscribersInWindow", started);
        m.put("monthlyRunRate", runRate);
        m.put("historyAvailable", false);
        m.put("note", "Subscriptions are stored as one row per account that renewal overwrites, "
                + "so individual payments leave no record. This is the value of current "
                + "subscriptions per month, not billed revenue for the window.");
        return m;
    }

    // ---- Series -------------------------------------------------------------

    /** One bucket per day across the window, including days nothing sold. */
    private List<Map<String, Object>> series(List<Booking> bookings, List<ShopOrder> orders,
                                             LocalDateTime since, int window) {
        Map<LocalDate, List<Booking>> bookingsByDay = bookings.stream()
                .collect(Collectors.groupingBy(b -> b.getCreatedAt().toLocalDate()));
        Map<LocalDate, List<ShopOrder>> ordersByDay = orders.stream()
                .collect(Collectors.groupingBy(o -> o.getCreatedAt().toLocalDate()));

        List<Map<String, Object>> series = new ArrayList<>(window);
        LocalDate day = since.toLocalDate();
        for (int i = 0; i < window; i++) {
            List<Booking> b = bookingsByDay.getOrDefault(day, List.of());
            List<ShopOrder> o = ordersByDay.getOrDefault(day, List.of());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", day.toString());
            row.put("count", b.size() + o.size());
            // Empty days are kept: a gap in a chart is information, and dropping them would
            // redraw a quiet fortnight as continuous trading.
            row.put("bookings", totalBy(b, this::bookingAmount, Booking::getCurrency));
            row.put("shopOrders", totalBy(o, ShopOrder::getTotalPrice, ShopOrder::getCurrency));
            series.add(row);
            day = day.plusDays(1);
        }
        return series;
    }

    // ---- Top sellers --------------------------------------------------------

    /** The ten accounts that sold the most in the window, across both order kinds. */
    private List<Map<String, Object>> topSellers(List<Booking> bookings, List<ShopOrder> orders) {
        Map<UUID, List<Map.Entry<BigDecimal, String>>> bySeller = new HashMap<>();
        for (Booking b : bookings) {
            if (b.getSellerId() == null) continue;
            bySeller.computeIfAbsent(b.getSellerId(), k -> new ArrayList<>())
                    .add(Map.entry(bookingAmount(b), currencyOf(b.getCurrency())));
        }
        for (ShopOrder o : orders) {
            if (o.getSellerId() == null) continue;
            bySeller.computeIfAbsent(o.getSellerId(), k -> new ArrayList<>())
                    .add(Map.entry(nz(o.getTotalPrice()), currencyOf(o.getCurrency())));
        }
        if (bySeller.isEmpty()) return List.of();

        Map<UUID, User> users = userRepository.findAllById(bySeller.keySet()).stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        return bySeller.entrySet().stream()
                .map(e -> {
                    Map<String, BigDecimal> totals = new TreeMap<>();
                    e.getValue().forEach(v -> totals.merge(v.getValue(), v.getKey(), BigDecimal::add));
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("sellerId", e.getKey());
                    User u = users.get(e.getKey());
                    if (u != null) {
                        m.put("name", u.getFullName());
                        m.put("email", u.getEmail());
                        m.put("avatarUrl", u.getAvatarUrl());
                    }
                    m.put("count", e.getValue().size());
                    m.put("totals", totals);
                    return m;
                })
                // Ranked on the largest single-currency total rather than a converted sum, for
                // the same reason nothing else here converts.
                .sorted(Comparator.comparing(
                        (Map<String, Object> m) -> maxValue(m.get("totals"))).reversed())
                .limit(10)
                .collect(Collectors.toList());
    }

    // ---- Helpers ------------------------------------------------------------

    private boolean isPaid(Booking b) {
        return b.getPaymentStatus() != null
                && BOOKING_PAID.contains(b.getPaymentStatus().toUpperCase());
    }

    /** The charged amount: the agreed price once there is one, the opening offer before that. */
    private BigDecimal bookingAmount(Booking b) {
        return nz(b.getAgreedPrice() != null ? b.getAgreedPrice() : b.getOfferedPrice());
    }

    /** Sums one collection into per-currency totals. */
    private <T> Map<String, BigDecimal> totalBy(Collection<T> rows,
                                                java.util.function.Function<T, BigDecimal> amount,
                                                java.util.function.Function<T, String> currency) {
        Map<String, BigDecimal> totals = new TreeMap<>();
        for (T row : rows) {
            totals.merge(currencyOf(currency.apply(row)), nz(amount.apply(row)), BigDecimal::add);
        }
        return totals;
    }

    private Map<String, BigDecimal> merge(Map<String, BigDecimal> a, Map<String, BigDecimal> b) {
        Map<String, BigDecimal> out = new TreeMap<>(a);
        b.forEach((k, v) -> out.merge(k, v, BigDecimal::add));
        return out;
    }

    @SuppressWarnings("unchecked")
    private BigDecimal maxValue(Object totals) {
        if (!(totals instanceof Map)) return BigDecimal.ZERO;
        return ((Map<String, BigDecimal>) totals).values().stream()
                .max(Comparator.naturalOrder()).orElse(BigDecimal.ZERO);
    }

    private boolean after(LocalDateTime when, LocalDateTime since) {
        return when != null && when.isAfter(since);
    }

    private BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    private String currencyOf(String c) { return c == null || c.isBlank() ? "PLN" : c.toUpperCase(); }
}
