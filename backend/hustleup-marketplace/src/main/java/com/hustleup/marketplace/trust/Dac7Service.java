package com.hustleup.marketplace.trust;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.booking.model.BookingStatus;
import com.hustleup.marketplace.booking.repository.BookingRepository;
import com.hustleup.marketplace.payments.service.StripeConnectService;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.shop.repository.ShopOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * DAC7 (EU Directive 2021/514, in Poland the "ustawa o wymianie informacji podatkowych"):
 * a platform must report, by 31 January, every seller who in the previous year made 30 or
 * more sales or earned more than EUR 2,000 — with their identity, tax ID, address and the
 * consideration paid and fees withheld per quarter.
 *
 * <p>This aggregates completed sales per seller and quarter, flags who is reportable, and
 * whether their identity details are on file. The threshold is configured in PLN
 * ({@code app.dac7.threshold-pln}, default 8,600 ≈ EUR 2,000) because amounts are not converted.
 */
@Service
@RequiredArgsConstructor
public class Dac7Service {

    static final int SALES_THRESHOLD = 30;

    private final BookingRepository bookings;
    private final ShopOrderRepository shopOrders;
    private final UserRepository users;
    private final SellerProfileRepository profiles;
    private final StripeConnectService stripe;

    @Value("${app.dac7.threshold-pln:8600}")
    private BigDecimal thresholdPln = BigDecimal.valueOf(8600);

    /** One seller's year: counts and gross per quarter, fees, and reporting status. */
    public record SellerYear(UUID sellerId, int sales, BigDecimal gross, BigDecimal fees,
                             BigDecimal[] grossByQuarter, int[] salesByQuarter, String currency,
                             boolean reportable, boolean detailsComplete) {}

    public SellerYear forSeller(UUID sellerId, int year) {
        return aggregate(year).getOrDefault(sellerId, new SellerYear(sellerId, 0, BigDecimal.ZERO, BigDecimal.ZERO,
                zeros(), new int[4], "PLN", false, profiles.findById(sellerId).map(SellerProfile::taxDetailsComplete).orElse(false)));
    }

    public Map<UUID, SellerYear> aggregate(int year) {
        Map<UUID, Acc> acc = new HashMap<>();
        for (Booking b : bookings.findAll()) {
            boolean sold = "TRANSFERRED".equals(b.getPaymentStatus())
                    || ("PAID".equals(b.getPaymentStatus()) && b.getStatus() == BookingStatus.COMPLETED);
            if (!sold || !inYear(b.getCreatedAt(), year) || b.getAgreedPrice() == null) continue;
            acc.computeIfAbsent(b.getSellerId(), k -> new Acc(b.getCurrency())).add(b.getCreatedAt(), b.getAgreedPrice());
        }
        for (ShopOrder o : shopOrders.findAll()) {
            boolean sold = "RELEASED".equals(o.getPayoutStatus());
            if (!sold || !inYear(o.getCreatedAt(), year) || o.getTotalPrice() == null) continue;
            acc.computeIfAbsent(o.getSellerId(), k -> new Acc(o.getCurrency())).add(o.getCreatedAt(), o.getTotalPrice());
        }
        BigDecimal feeRate = stripe.getPlatformFeePercent().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        Map<UUID, SellerYear> out = new LinkedHashMap<>();
        acc.forEach((sellerId, a) -> {
            BigDecimal gross = Arrays.stream(a.gross).reduce(BigDecimal.ZERO, BigDecimal::add);
            int sales = Arrays.stream(a.count).sum();
            boolean reportable = sales >= SALES_THRESHOLD || ("PLN".equalsIgnoreCase(a.currency) && gross.compareTo(thresholdPln) > 0);
            boolean complete = profiles.findById(sellerId).map(SellerProfile::taxDetailsComplete).orElse(false);
            out.put(sellerId, new SellerYear(sellerId, sales, gross, gross.multiply(feeRate).setScale(2, RoundingMode.HALF_UP),
                    a.gross, a.count, a.currency, reportable, complete));
        });
        return out;
    }

    /** The annual DAC7 export: one line per reportable seller (or every seller with sales). */
    public String csv(int year, boolean onlyReportable) {
        StringBuilder sb = new StringBuilder("seller_id,seller_type,legal_name,business_name,tax_id,vat_number,registration_no,"
                + "date_of_birth,address,city,postal_code,country,email,sales,gross,fees,currency,"
                + "q1_sales,q1_gross,q2_sales,q2_gross,q3_sales,q3_gross,q4_sales,q4_gross,reportable,details_complete\n");
        for (SellerYear y : aggregate(year).values()) {
            if (onlyReportable && !y.reportable()) continue;
            SellerProfile p = profiles.findById(y.sellerId()).orElse(null);
            User u = users.findById(y.sellerId()).orElse(null);
            List<Object> row = new ArrayList<>(List.of(y.sellerId(),
                    p == null ? "PRIVATE" : p.getSellerType(),
                    p == null || p.getLegalName() == null ? (u == null ? "" : nz(u.getFullName())) : p.getLegalName(),
                    p == null ? "" : nz(p.getBusinessName()), p == null ? "" : nz(p.getTaxId()), p == null ? "" : nz(p.getVatNumber()),
                    p == null ? "" : nz(p.getRegistrationNo()), p == null || p.getDateOfBirth() == null ? "" : p.getDateOfBirth(),
                    p == null ? "" : nz(p.getAddressLine1()), p == null ? "" : nz(p.getCity()), p == null ? "" : nz(p.getPostalCode()),
                    p == null ? "" : nz(p.getCountry()), u == null ? "" : nz(u.getEmail()),
                    y.sales(), y.gross().setScale(2, RoundingMode.HALF_UP), y.fees(), y.currency()));
            for (int q = 0; q < 4; q++) { row.add(y.salesByQuarter()[q]); row.add(y.grossByQuarter()[q].setScale(2, RoundingMode.HALF_UP)); }
            row.add(y.reportable()); row.add(y.detailsComplete());
            sb.append(String.join(",", row.stream().map(Dac7Service::cell).toList())).append('\n');
        }
        return sb.toString();
    }

    private static boolean inYear(LocalDateTime t, int year) { return t != null && t.getYear() == year; }
    private static String nz(String s) { return s == null ? "" : s; }
    private static BigDecimal[] zeros() { return new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO}; }

    /** CSV-safe and formula-safe (a cell starting with = + - @ would run in a spreadsheet). */
    private static String cell(Object o) {
        String s = String.valueOf(o);
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0 && !s.matches("-?\\d+(\\.\\d+)?")) s = "'" + s;
        return s.contains(",") || s.contains("\"") || s.contains("\n") ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }

    private static final class Acc {
        final BigDecimal[] gross = zeros();
        final int[] count = new int[4];
        final String currency;
        Acc(String currency) { this.currency = currency == null ? "PLN" : currency; }
        void add(LocalDateTime when, BigDecimal amount) {
            int q = (when.getMonthValue() - 1) / 3;
            gross[q] = gross[q].add(amount);
            count[q]++;
        }
    }
}
