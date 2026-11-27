package com.hustleup.marketplace.trust;

import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.listing.model.Listing;
import com.hustleup.marketplace.listing.model.ListingStatus;
import com.hustleup.marketplace.listing.repository.ListingRepository;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.hustleup.marketplace.safety.SellerSafetyService;
import com.hustleup.marketplace.safety.SuspensionRecoveryService;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import com.stripe.Stripe;
import com.stripe.model.Account;
import com.stripe.model.BankAccount;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Marketplace moderation: user reports (notice and action), the listing review queue, seller
 * strikes, and linking repeat offenders by their payout bank account.
 *
 * <p>Every action that takes something away from a seller records a reason and sends it to
 * them — the DSA's "statement of reasons" — and the person who reported is told the outcome.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrustService {

    /** Distinct open reports that pull a listing out of browse until a moderator looks. */
    static final int AUTO_HOLD_REPORTS = 3;
    /** Upheld claims or warnings after which a seller is suspended automatically. */
    public static final int STRIKE_LIMIT = 3;

    private final MarketplaceReportRepository reports;
    private final SellerProfileRepository profiles;
    private final ListingRepository listings;
    private final ShopRepository shops;
    private final UserRepository users;
    private final NotificationRepository notifications;
    private final SellerPayoutAccountRepository payoutAccounts;
    private final SellerSafetyService sellerSafety;
    private final SuspensionRecoveryService recovery;

    // ── Reports ────────────────────────────────────────────────────────────────────────

    @Transactional
    public MarketplaceReport report(MarketplaceReport.TargetType type, UUID targetId,
                                    MarketplaceReport.Reason reason, String detail) {
        User reporter = currentUser();
        if (detail != null && detail.length() > 2000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keep the description under 2000 characters");

        UUID sellerId = switch (type) {
            case LISTING -> listings.findById(targetId).map(Listing::getSellerId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
            case SHOP -> shops.findById(targetId).map(s -> s.getOwnerId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shop not found"));
            case SELLER -> users.findById(targetId).map(User::getId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Seller not found"));
        };
        if (reporter.getId().equals(sellerId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot report yourself");
        if (reports.existsByReporterIdAndTargetTypeAndTargetIdAndStatus(reporter.getId(), type, targetId, MarketplaceReport.Status.OPEN))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already reported this — our team is looking at it");

        MarketplaceReport saved = reports.save(MarketplaceReport.builder()
                .targetType(type).targetId(targetId).sellerId(sellerId).reporterId(reporter.getId())
                .reason(reason).detail(detail == null ? null : detail.trim()).build());

        // Several independent reports on one live listing: take it down until someone looks,
        // so a scam does not keep taking money while it waits in the queue.
        if (type == MarketplaceReport.TargetType.LISTING) {
            long distinct = reports.findByStatusOrderByCreatedAtAsc(MarketplaceReport.Status.OPEN).stream()
                    .filter(r -> r.getTargetType() == type && targetId.equals(r.getTargetId()))
                    .map(MarketplaceReport::getReporterId).distinct().count();
            if (distinct >= AUTO_HOLD_REPORTS) {
                listings.findById(targetId).filter(l -> l.getStatus() == ListingStatus.ACTIVE).ifPresent(l -> {
                    hold(l, "Reported by several users — paused while our team reviews it");
                });
            }
        }
        return saved;
    }

    public enum ReportAction { DISMISS, WARN_SELLER, REMOVE_LISTING, SUSPEND_SELLER }

    @Transactional
    public MarketplaceReport resolveReport(UUID reportId, ReportAction action, String note) {
        User admin = currentUser();
        MarketplaceReport r = reports.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        if (r.getStatus() != MarketplaceReport.Status.OPEN)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This report has already been handled");
        if (action != ReportAction.DISMISS && (note == null || note.isBlank()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give the reason the seller will see");

        switch (action) {
            case DISMISS -> { }
            case WARN_SELLER -> addStrike(r.getSellerId(), note);
            case REMOVE_LISTING -> {
                if (r.getTargetType() != MarketplaceReport.TargetType.LISTING)
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only a reported listing can be removed");
                removeListing(r.getTargetId(), note);
                addStrike(r.getSellerId(), note);
            }
            case SUSPEND_SELLER -> suspendSeller(r.getSellerId(), note);
        }
        r.setStatus(action == ReportAction.DISMISS ? MarketplaceReport.Status.DISMISSED : MarketplaceReport.Status.ACTIONED);
        r.setActionTaken(action.name());
        r.setResolutionNote(note);
        r.setResolvedBy(admin.getId());
        r.setResolvedAt(LocalDateTime.now());
        notify(r.getReporterId(), "Your report was reviewed",
                action == ReportAction.DISMISS
                        ? "Thanks for flagging this. We reviewed it and did not find a breach of our rules."
                        : "Thanks for flagging this. We reviewed it and took action.", "MODERATION", r.getTargetId());
        return reports.save(r);
    }

    // ── Listing review queue ───────────────────────────────────────────────────────────

    /** Holds a listing for review (status PENDING_REVIEW) and tells the seller why. */
    public void hold(Listing listing, String reason) {
        listing.setStatus(ListingStatus.PENDING_REVIEW);
        listing.setReviewReason(reason);
        listings.save(listing);
        notify(listing.getSellerId(), "Your listing is being reviewed",
                "\"" + listing.getTitle() + "\" is not visible yet while our team checks it: " + reason
                        + ". This usually takes less than a day.", "MODERATION", listing.getId());
    }

    @Transactional
    public Listing approveListing(UUID listingId, String note) {
        User admin = currentUser();
        Listing l = listings.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        if (l.getStatus() != ListingStatus.PENDING_REVIEW)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This listing is not waiting for review");
        if (sellerSafety.suspended(l.getSellerId()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The seller is suspended");
        l.setStatus(ListingStatus.ACTIVE);
        l.setReviewReason(note == null || note.isBlank() ? null : note);
        l.setReviewedAt(LocalDateTime.now());
        l.setReviewedBy(admin.getId());
        notify(l.getSellerId(), "Your listing is live", "\"" + l.getTitle() + "\" passed review and is now visible.",
                "LISTING_APPROVED", l.getId());
        return listings.save(l);
    }

    @Transactional
    public Listing removeListing(UUID listingId, String reason) {
        User admin = currentUser();
        if (reason == null || reason.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give the reason the seller will see");
        Listing l = listings.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Listing not found"));
        l.setStatus(ListingStatus.REMOVED);
        l.setReviewReason(reason);
        l.setReviewedAt(LocalDateTime.now());
        l.setReviewedBy(admin.getId());
        notify(l.getSellerId(), "Your listing was removed",
                "\"" + l.getTitle() + "\" was removed because: " + reason
                        + ". If you think this is a mistake, reply to this notice through Help → Report a problem to appeal.",
                "MODERATION", l.getId());
        return listings.save(l);
    }

    public List<Listing> reviewQueue() {
        return listings.findByStatusOrderByCreatedAtAsc(ListingStatus.PENDING_REVIEW);
    }

    // ── Strikes and suspension ─────────────────────────────────────────────────────────

    /** Records a strike; the {@value #STRIKE_LIMIT}rd suspends the seller automatically. */
    @Transactional
    public SellerProfile addStrike(UUID sellerId, String reason) {
        if (sellerId == null) return null;
        SellerProfile p = profile(sellerId);
        p.setStrikes(p.getStrikes() + 1);
        p.setUpdatedAt(LocalDateTime.now());
        profiles.save(p);
        notify(sellerId, "Warning on your seller account",
                reason + " — this is strike " + p.getStrikes() + " of " + STRIKE_LIMIT
                        + ". At " + STRIKE_LIMIT + " strikes selling is suspended.", "MODERATION", sellerId);
        if (p.getStrikes() >= STRIKE_LIMIT && !sellerSafety.suspended(sellerId)) {
            suspendSeller(sellerId, "Reached " + STRIKE_LIMIT + " strikes. Latest: " + reason);
        }
        return p;
    }

    /** Takes back a strike when the decision that caused it is overturned on appeal. */
    @Transactional
    public void removeStrike(UUID sellerId) {
        if (sellerId == null) return;
        profiles.findById(sellerId).filter(p -> p.getStrikes() > 0).ifPresent(p -> {
            p.setStrikes(p.getStrikes() - 1);
            p.setUpdatedAt(LocalDateTime.now());
            profiles.save(p);
        });
    }

    /**
     * Suspends a seller (listings hidden, new orders blocked, open orders refunded and
     * payouts paused by {@link SellerSafetyService}/{@link SuspensionRecoveryService}) and every
     * other account paid out to the same bank account.
     */
    public void suspendSeller(UUID sellerId, String reason) {
        sellerSafety.suspend(sellerId, reason, true);
        try { recovery.recover(sellerId); } catch (Exception e) {
            log.warn("Recovery after suspending {} needs a retry from the admin console: {}", sellerId, e.getMessage());
        }
        notify(sellerId, "Your selling is suspended",
                "Your seller account was suspended because: " + reason
                        + ". Open orders are being refunded. You can appeal through Help → Report a problem.",
                "MODERATION", sellerId);
        profiles.findById(sellerId).map(SellerProfile::getBankFingerprint).filter(f -> f != null && !f.isBlank())
                .ifPresent(fp -> profiles.findByBankFingerprint(fp).stream()
                        .map(SellerProfile::getUserId).filter(other -> !other.equals(sellerId))
                        .filter(other -> !sellerSafety.suspended(other))
                        .forEach(other -> linkSuspend(other, sellerId)));
    }

    private void linkSuspend(UUID accountId, UUID suspendedSeller) {
        SellerProfile p = profile(accountId);
        p.setLinkedTo(suspendedSeller);
        profiles.save(p);
        try {
            sellerSafety.suspend(accountId, "Uses the same payout bank account as a suspended seller", true);
            recovery.recover(accountId);
        } catch (Exception e) {
            log.warn("Could not suspend linked account {}: {}", accountId, e.getMessage());
        }
    }

    /**
     * Hourly: record the payout bank fingerprint of each connected seller (Stripe returns the
     * same fingerprint for the same bank account across accounts) and suspend any account that
     * shares one with a suspended seller — a banned scammer opening a fresh account.
     */
    @Scheduled(initialDelayString = "${app.trust.fingerprint-initial-ms:120000}",
               fixedDelayString = "${app.trust.fingerprint-ms:3600000}")
    public void syncBankFingerprints() {
        if (Stripe.apiKey == null || Stripe.apiKey.isBlank()) return;
        for (SellerPayoutAccount account : payoutAccounts.findAll()) {
            try {
                SellerProfile p = profile(account.getSellerId());
                if (p.getBankFingerprint() != null) continue;
                Account acct = Account.retrieve(account.getStripeAccountId());
                if (acct.getExternalAccounts() == null || acct.getExternalAccounts().getData() == null) continue;
                String fp = acct.getExternalAccounts().getData().stream()
                        .filter(BankAccount.class::isInstance).map(o -> ((BankAccount) o).getFingerprint())
                        .filter(f -> f != null && !f.isBlank()).findFirst().orElse(null);
                if (fp == null) continue;
                p.setBankFingerprint(fp);
                p.setUpdatedAt(LocalDateTime.now());
                profiles.save(p);
                profiles.findByBankFingerprint(fp).stream().map(SellerProfile::getUserId)
                        .filter(other -> !other.equals(account.getSellerId()) && sellerSafety.suspended(other))
                        .findFirst()
                        .filter(x -> !sellerSafety.suspended(account.getSellerId()))
                        .ifPresent(banned -> linkSuspend(account.getSellerId(), banned));
            } catch (Exception e) {
                log.debug("Fingerprint sync skipped for seller {}: {}", account.getSellerId(), e.getMessage());
            }
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────────────

    public SellerProfile profile(UUID userId) {
        return profiles.findById(userId).orElseGet(() -> SellerProfile.builder().userId(userId).build());
    }

    private void notify(UUID userId, String title, String message, String type, UUID ref) {
        if (userId == null) return;
        try {
            notifications.save(Notification.builder().userId(userId).title(title).message(message)
                    .notificationType(type).referenceId(ref).build());
        } catch (Exception e) {
            log.warn("Could not notify {} about moderation: {}", userId, e.getMessage());
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return users.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
