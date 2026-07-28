/**
 * Links a seller to their Stripe Connect Express account.
 *
 * <p><b>Security note:</b> HustleUp never stores a seller's actual bank account number,
 * sort code/IBAN, or identity documents. All of that is collected and held by Stripe on
 * their own hosted onboarding form (see {@code StripeConnectService#createOnboardingLink}).
 * This table only stores {@link #stripeAccountId} — an opaque reference safe to keep in
 * our own database — plus the capability flags Stripe reports back for that account.
 *
 * <h3>Table: {@code seller_payout_accounts}</h3>
 * One row per seller, at most (unique {@code seller_id}).
 */
package com.hustleup.marketplace.payments.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "seller_payout_accounts", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"seller_id"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SellerPayoutAccount {

    @Id
    @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "seller_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID sellerId;

    // Stripe's identifier for the seller's Express account (e.g. "acct_1P...").
    // Opaque to us — all sensitive banking/identity data lives behind this reference on Stripe's side.
    @Column(name = "stripe_account_id", nullable = false)
    private String stripeAccountId;

    // True once Stripe has verified enough identity/bank info to accept card charges on
    // this account's behalf (relevant if the seller ever charges directly; not required
    // for the transfer-based payout model used here, but useful for future features).
    @Column(name = "charges_enabled")
    @Builder.Default
    private boolean chargesEnabled = false;

    // True once Stripe can actually send money to this account's bank account — this is
    // the flag that matters for payouts. Kept in sync via the account.updated webhook.
    @Column(name = "payouts_enabled")
    @Builder.Default
    private boolean payoutsEnabled = false;

    // Whether the seller has completed Stripe's onboarding form at least once (they may
    // still need to submit more info later if Stripe asks for additional verification).
    @Column(name = "details_submitted")
    @Builder.Default
    private boolean detailsSubmitted = false;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
