/**
 * Encapsulates all Stripe Connect integration for paying sellers.
 *
 * <h2>Why Stripe Connect?</h2>
 * <p>HustleUp must never store a seller's bank account number directly — that's sensitive
 * financial data with serious security/compliance obligations. Stripe Connect solves this:
 * each seller gets their own "Express" account, and Stripe's own hosted onboarding form
 * collects their bank details and does identity verification (KYC). We only ever store the
 * resulting {@code stripeAccountId} — an opaque reference, safe to keep in our database.
 *
 * <h2>How money actually moves (escrow-style, matching the existing booking lifecycle)</h2>
 * <ol>
 *   <li>A booking reaches {@code BOOKED} — the buyer is charged via a Stripe Checkout
 *       Session ({@link #createPaymentCheckoutSession}). The charge lands on HustleUp's
 *       own Stripe balance, <b>not</b> the seller's — no transfer has happened yet.</li>
 *   <li>The seller delivers the service/product and marks the booking {@code COMPLETED}.
 *       Only then does {@link #transferToSeller} move the seller's share (agreed price
 *       minus the platform fee) to their connected account.</li>
 *   <li>If the booking is cancelled before completion, {@link #refundPayment} returns the
 *       buyer's money in full — no transfer to the seller ever occurs.</li>
 * </ol>
 * <p>This gives buyers real protection (a seller can't be paid for work never delivered)
 * without HustleUp building a bespoke escrow system from scratch — Stripe's platform
 * balance <em>is</em> the escrow.
 *
 * <h2>Test-mode note</h2>
 * <p>Like the subscription service's Stripe integration, this runs against whatever key is
 * configured via {@code STRIPE_SECRET_KEY}. With the development placeholder key, calls to
 * Stripe's API will fail with an authentication error — this is expected until a real
 * Stripe account with Connect enabled is configured.
 */
package com.hustleup.marketplace.payments.service;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Account;
import com.stripe.model.AccountLink;
import com.stripe.model.Refund;
import com.stripe.model.Transfer;
import com.stripe.model.checkout.Session;
import com.stripe.param.AccountCreateParams;
import com.stripe.param.AccountLinkCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.TransferCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class StripeConnectService {

    private final SellerPayoutAccountRepository payoutAccountRepository;
    private final UserRepository userRepository;

    @Value("${app.stripe.secret-key}")
    private String secretKey;

    // Platform's cut of each completed booking, as a whole-number percentage (e.g. 8 = 8%).
    @Value("${app.stripe.platform-fee-percent}")
    private BigDecimal platformFeePercent;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public StripeConnectService(SellerPayoutAccountRepository payoutAccountRepository, UserRepository userRepository) {
        this.payoutAccountRepository = payoutAccountRepository;
        this.userRepository = userRepository;
    }

    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
    }

    /**
     * Finds (or creates) the seller's Stripe Express account and returns a fresh onboarding
     * link URL. The seller completes the actual bank/ID details on Stripe's own hosted page —
     * we redirect them there and never see the raw data ourselves.
     *
     * @param sellerId the seller setting up payouts
     * @return a one-time-use Stripe-hosted onboarding URL (typically valid for a few minutes)
     */
    public String createOnboardingLink(UUID sellerId) throws StripeException {
        User seller = userRepository.findById(sellerId)
                .orElseThrow(() -> new RuntimeException("Seller not found"));

        SellerPayoutAccount payoutAccount = payoutAccountRepository.findBySellerId(sellerId).orElse(null);

        if (payoutAccount == null) {
            // First time this seller is setting up payouts — create their Express account.
            AccountCreateParams params = AccountCreateParams.builder()
                    .setType(AccountCreateParams.Type.EXPRESS)
                    .setEmail(seller.getEmail())
                    .setCountry("PL") // HustleUp's primary market
                    .setCapabilities(
                            AccountCreateParams.Capabilities.builder()
                                    .setTransfers(AccountCreateParams.Capabilities.Transfers.builder()
                                            .setRequested(true).build())
                                    .setCardPayments(AccountCreateParams.Capabilities.CardPayments.builder()
                                            .setRequested(true).build())
                                    .build())
                    .build();
            Account account = Account.create(params);

            payoutAccount = payoutAccountRepository.save(
                    SellerPayoutAccount.builder()
                            .sellerId(sellerId)
                            .stripeAccountId(account.getId())
                            .build());
        }

        AccountLinkCreateParams linkParams = AccountLinkCreateParams.builder()
                .setAccount(payoutAccount.getStripeAccountId())
                .setType(AccountLinkCreateParams.Type.ACCOUNT_ONBOARDING)
                // If the link expires before the seller finishes, Stripe sends them back here
                // so the frontend can request a fresh one.
                .setRefreshUrl(frontendUrl + "/dashboard?payout=refresh")
                .setReturnUrl(frontendUrl + "/dashboard?payout=complete")
                .build();

        return AccountLink.create(linkParams).getUrl();
    }

    /**
     * Re-fetches the account from Stripe and syncs our local capability flags. Called both
     * on-demand (status endpoint, right after the seller returns from onboarding) and from
     * the {@code account.updated} webhook, since Stripe can flip these flags asynchronously
     * (e.g. after manual review).
     */
    public SellerPayoutAccount refreshAccountStatus(SellerPayoutAccount payoutAccount) throws StripeException {
        Account account = Account.retrieve(payoutAccount.getStripeAccountId());
        payoutAccount.setChargesEnabled(Boolean.TRUE.equals(account.getChargesEnabled()));
        payoutAccount.setPayoutsEnabled(Boolean.TRUE.equals(account.getPayoutsEnabled()));
        payoutAccount.setDetailsSubmitted(Boolean.TRUE.equals(account.getDetailsSubmitted()));
        payoutAccount.setUpdatedAt(LocalDateTime.now());
        return payoutAccountRepository.save(payoutAccount);
    }

    /**
     * Creates a Stripe Checkout Session for the buyer to actually pay for a {@code BOOKED}
     * booking. The charge is captured on HustleUp's own platform balance — no money moves
     * to the seller yet (see class-level docs for the full escrow-style flow).
     *
     * @param booking      the booking being paid for (must already have an agreedPrice)
     * @param listingTitle shown as the line-item name on Stripe's hosted payment page
     * @return the Stripe-hosted checkout URL to redirect the buyer to
     */
    public CheckoutResult createPaymentCheckoutSession(Booking booking, String listingTitle) throws StripeException {
        int quantity = Math.max(1, booking.getQuantity());
        long totalMinorUnits = toMinorUnits(booking.getAgreedPrice());

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/dashboard?payment=success")
                .setCancelUrl(frontendUrl + "/dashboard?payment=cancelled")
                // transfer_group ties this charge to the later Transfer for the same booking
                // so the eventual seller payout can be reconciled back to the original payment.
                // See createCartCheckoutSession: the PaymentIntent does not exist yet at
                // session-creation time, so the booking id must also travel on the session
                // for the webhook to be able to resolve it.
                .putMetadata("bookingIds", booking.getId().toString())
                .setPaymentIntentData(
                        SessionCreateParams.PaymentIntentData.builder()
                                .setTransferGroup(booking.getId().toString())
                                .putMetadata("bookingId", booking.getId().toString())
                                .build())
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity((long) quantity)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(booking.getCurrency().toLowerCase())
                                .setUnitAmount(totalMinorUnits / quantity)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName(listingTitle)
                                        .build())
                                .build())
                        .build())
                .build();

        Session session = Session.create(params);
        // For a payment-mode Checkout Session, Stripe creates the underlying PaymentIntent
        // synchronously — its ID is available immediately for us to store and reconcile later.
        return new CheckoutResult(session.getUrl(), session.getPaymentIntent());
    }

    /**
     * Creates ONE Stripe Checkout Session covering an entire cart — one line item per
     * booking, a single card charge.
     *
     * <p><b>Why one charge works even across several sellers:</b> this is a
     * "separate charges and transfers" setup, not a destination charge. The money lands
     * wholly on the platform balance and each seller is paid later by
     * {@link #transferToSeller} when their own booking is marked COMPLETED. A destination
     * charge could only ever pay one connected account, which would make a multi-seller
     * cart impossible to express as a single payment.
     *
     * <p>Every booking id is written into the PaymentIntent metadata so the webhook can
     * mark the whole order paid — see {@code findAllByPaymentIntentId}.
     *
     * @param bookings the bookings making up this order, all owned by the same buyer
     * @param titles   display names, index-aligned with {@code bookings}
     * @return the hosted checkout URL plus the PaymentIntent id to persist on every booking
     */
    public CheckoutResult createCartCheckoutSession(java.util.List<Booking> bookings,
                                                    java.util.List<String> titles) throws StripeException {
        if (bookings == null || bookings.isEmpty()) {
            throw new IllegalArgumentException("Cannot start a checkout with no items");
        }

        // Stripe requires every line item in one session to share a currency.
        String currency = bookings.get(0).getCurrency();
        for (Booking b : bookings) {
            if (!currency.equalsIgnoreCase(b.getCurrency())) {
                throw new IllegalArgumentException(
                        "All items in one checkout must share a currency (found "
                        + currency + " and " + b.getCurrency() + ")");
            }
        }

        String ids = bookings.stream()
                .map(b -> b.getId().toString())
                .collect(java.util.stream.Collectors.joining(","));

        SessionCreateParams.Builder params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/checkout/confirmation?payment=success")
                .setCancelUrl(frontendUrl + "/checkout?payment=cancelled")
                // Booking ids go on the SESSION, not only on the PaymentIntent. Stripe does
                // not create the PaymentIntent until the customer actually starts paying, so
                // at this moment session.getPaymentIntent() is null and there is nothing to
                // store on the booking rows. The checkout.session.completed event carries
                // this metadata back, which is what lets the webhook mark the right orders
                // paid without needing a PaymentIntent id we never had.
                .putMetadata("bookingIds", ids)
                .setPaymentIntentData(
                        SessionCreateParams.PaymentIntentData.builder()
                                // One transfer group for the order, so the per-seller
                                // transfers made later all reconcile to this one charge.
                                .setTransferGroup("order_" + bookings.get(0).getId())
                                .putMetadata("bookingIds", ids)
                                .build());

        for (int i = 0; i < bookings.size(); i++) {
            Booking b = bookings.get(i);
            int qty = Math.max(1, b.getQuantity());
            long total = toMinorUnits(b.getAgreedPrice());
            params.addLineItem(SessionCreateParams.LineItem.builder()
                    .setQuantity((long) qty)
                    .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(b.getCurrency().toLowerCase())
                            // agreedPrice is the line total, so divide back out to the
                            // unit price Stripe multiplies by quantity.
                            .setUnitAmount(total / qty)
                            .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(i < titles.size() && titles.get(i) != null
                                            ? titles.get(i) : "Item")
                                    .build())
                            .build())
                    .build());
        }

        Session session = Session.create(params.build());
        return new CheckoutResult(session.getUrl(), session.getPaymentIntent());
    }

    /**
     * Creates a Checkout Session for a storefront order.
     *
     * <p>Separate from {@link #createCartCheckoutSession} because shop orders are their own
     * entity: the ids in metadata are {@code shopOrderIds}, and the buyer returns to the
     * shop's confirmation page rather than the marketplace one. Like the cart flow, the
     * charge lands on the platform balance and the seller is paid later.
     *
     * @param orders   the storefront orders in this purchase, all for the same buyer
     * @param shopSlug used to build the return URLs back to the right storefront
     */
    public CheckoutResult createShopCheckoutSession(java.util.List<com.hustleup.marketplace.shop.model.ShopOrder> orders,
                                                    String shopSlug) throws StripeException {
        if (orders == null || orders.isEmpty()) {
            throw new IllegalArgumentException("Cannot start a checkout with no items");
        }

        String currency = orders.get(0).getCurrency();
        for (var o : orders) {
            if (!currency.equalsIgnoreCase(o.getCurrency())) {
                throw new IllegalArgumentException("All items in one checkout must share a currency");
            }
        }

        String ids = orders.stream()
                .map(o -> o.getId().toString())
                .collect(java.util.stream.Collectors.joining(","));

        SessionCreateParams.Builder params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(frontendUrl + "/shop/" + shopSlug + "/orders?payment=success")
                .setCancelUrl(frontendUrl + "/shop/" + shopSlug + "?payment=cancelled")
                // On the session, not only on the PaymentIntent: Stripe does not create the
                // PaymentIntent until the buyer starts paying, so there is nothing to store
                // on the order rows at this point. checkout.session.completed carries this
                // back, which is how the webhook knows which orders to mark paid.
                .putMetadata("shopOrderIds", ids)
                .setPaymentIntentData(
                        SessionCreateParams.PaymentIntentData.builder()
                                .setTransferGroup("shop_" + orders.get(0).getId())
                                .putMetadata("shopOrderIds", ids)
                                .build());

        for (var o : orders) {
            int qty = Math.max(1, o.getQuantity());
            long total = toMinorUnits(o.getTotalPrice());
            params.addLineItem(SessionCreateParams.LineItem.builder()
                    .setQuantity((long) qty)
                    .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(o.getCurrency().toLowerCase())
                            .setUnitAmount(total / qty)
                            .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(o.getProductName() != null ? o.getProductName() : "Item")
                                    .build())
                            .build())
                    .build());
        }

        Session session = Session.create(params.build());
        return new CheckoutResult(session.getUrl(), session.getPaymentIntent());
    }

    /** Simple holder so callers get both the redirect URL and the PaymentIntent id to persist. */
    public record CheckoutResult(String checkoutUrl, String paymentIntentId) {}

    /**
     * Pays the seller their share of a completed booking — the agreed price minus the
     * platform fee — directly to their connected Stripe account. Only ever called once
     * the booking's paymentStatus is {@code PAID}, i.e. a real charge exists to pay out from.
     *
     * @return the Stripe Transfer id, stored on the booking for reconciliation
     */
    public String transferToSeller(Booking booking, String sellerStripeAccountId) throws StripeException {
        BigDecimal keepFraction = BigDecimal.ONE.subtract(
                platformFeePercent.divide(BigDecimal.valueOf(100)));
        long payoutMinorUnits = BigDecimal.valueOf(toMinorUnits(booking.getAgreedPrice()))
                .multiply(keepFraction)
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();

        TransferCreateParams params = TransferCreateParams.builder()
                .setAmount(payoutMinorUnits)
                .setCurrency(booking.getCurrency().toLowerCase())
                .setDestination(sellerStripeAccountId)
                .setTransferGroup(booking.getId().toString())
                .putMetadata("bookingId", booking.getId().toString())
                .build();

        return Transfer.create(params).getId();
    }

    /** Refunds the buyer in full when a paid booking is cancelled before completion. */
    public void refundPayment(String paymentIntentId) throws StripeException {
        Refund.create(RefundCreateParams.builder().setPaymentIntent(paymentIntentId).build());
    }

    // Stripe amounts are always integers in the currency's smallest unit (e.g. groszy for PLN).
    private long toMinorUnits(BigDecimal amount) {
        return amount.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }
}
