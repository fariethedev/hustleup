package com.hustleup.marketplace.payments.service;

import com.hustleup.common.repository.UserRepository;
import com.hustleup.marketplace.booking.model.Booking;
import com.hustleup.marketplace.shop.model.ShopOrder;
import com.hustleup.marketplace.payments.model.SellerPayoutAccount;
import com.hustleup.marketplace.payments.repository.SellerPayoutAccountRepository;
import com.stripe.model.LoginLink;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Transfer;
import com.stripe.net.RequestOptions;
import com.stripe.param.TransferCreateParams;
import com.stripe.param.LoginLinkCreateOnAccountParams;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StripeConnectServiceTest {
    private final StripeConnectService service = new StripeConnectService(
            mock(SellerPayoutAccountRepository.class), mock(UserRepository.class));

    @Test void orderAndBookingTransfersUseDistinctStableKeysAndSourceCharge() throws Exception {
        ReflectionTestUtils.setField(service, "platformFeePercent", new BigDecimal("8"));
        UUID id = UUID.randomUUID();
        ShopOrder order = ShopOrder.builder().id(id).totalPrice(new BigDecimal("100"))
                .currency("PLN").paymentIntentId("pi_paid").build();
        Booking booking = Booking.builder().id(id).agreedPrice(new BigDecimal("100"))
                .currency("PLN").paymentIntentId("pi_paid").build();
        PaymentIntent intent = new PaymentIntent(); intent.setLatestCharge("ch_paid");
        Transfer transfer = new Transfer(); transfer.setId("tr_paid");
        try (var intents = mockStatic(PaymentIntent.class); var transfers = mockStatic(Transfer.class)) {
            intents.when(() -> PaymentIntent.retrieve("pi_paid")).thenReturn(intent);
            transfers.when(() -> Transfer.create(any(TransferCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        TransferCreateParams params = call.getArgument(0);
                        RequestOptions options = call.getArgument(1);
                        assertEquals(9200L, params.getAmount());
                        assertEquals("pln", params.getCurrency());
                        assertEquals("acct_owner", params.getDestination());
                        assertEquals("ch_paid", params.getSourceTransaction());
                        assertNull(params.getTransferGroup(), "Source-funded transfers inherit the charge group");
                        assertTrue(options.getIdempotencyKey().equals("shop-order-payout-" + id)
                                || options.getIdempotencyKey().equals("booking-payout-" + id));
                        return transfer;
                    });
            assertEquals("tr_paid", service.transferToSeller(order, "acct_owner"));
            assertEquals("tr_paid", service.transferToSeller(order, "acct_owner"));
            assertEquals("tr_paid", service.transferToSeller(booking, "acct_owner"));
            transfers.verify(() -> Transfer.create(any(TransferCreateParams.class),
                    argThat(options -> ("shop-order-payout-" + id).equals(options.getIdempotencyKey()))), times(2));
            transfers.verify(() -> Transfer.create(any(TransferCreateParams.class),
                    argThat(options -> ("booking-payout-" + id).equals(options.getIdempotencyKey()))));
        }
    }

    @Test void dashboardLinkUsesStoredAccountNotClientSuppliedId() throws Exception {
        LoginLink link = new LoginLink(); link.setUrl("https://stripe.com/express/test");
        try (var links = mockStatic(LoginLink.class)) {
            links.when(() -> LoginLink.createOnAccount(eq("acct_owner"), any(LoginLinkCreateOnAccountParams.class)))
                    .thenReturn(link);
            assertEquals(link.getUrl(), service.createDashboardLink(
                    SellerPayoutAccount.builder().stripeAccountId("acct_owner").build()));
        }
    }

    @Test void legacyBalanceFundedTransferRetainsItsOrderGroup() throws Exception {
        ReflectionTestUtils.setField(service, "platformFeePercent", new BigDecimal("8"));
        UUID id = UUID.randomUUID();
        ShopOrder order = ShopOrder.builder().id(id).totalPrice(new BigDecimal("100")).currency("PLN").build();
        Transfer result = new Transfer(); result.setId("tr_legacy");
        try (var transfers = mockStatic(Transfer.class)) {
            transfers.when(() -> Transfer.create(any(TransferCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        TransferCreateParams params = call.getArgument(0);
                        assertNull(params.getSourceTransaction());
                        assertEquals(id.toString(), params.getTransferGroup());
                        assertEquals(9200L, params.getAmount());
                        return result;
                    });
            assertEquals("tr_legacy", service.transferToSeller(order, "acct_owner"));
        }
    }

    @Test void cachedSuccessfulTransferIsReusedWithoutAnotherPayment() throws Exception {
        assertOldRequestRecovery(true, false);
    }

    @Test void knownCachedGroupFailureCanRetryWithStableCorrectedKey() throws Exception {
        assertOldRequestRecovery(false, true);
    }

    @Test void unknownOriginalFailureDoesNotPermitANewPaymentKey() throws Exception {
        assertOldRequestRecovery(false, false);
    }

    private void assertOldRequestRecovery(boolean alreadyPaid, boolean knownGroupFailure) throws Exception {
        ReflectionTestUtils.setField(service, "platformFeePercent", new BigDecimal("8"));
        UUID id = UUID.randomUUID();
        Booking booking = Booking.builder().id(id).agreedPrice(new BigDecimal("100"))
                .currency("PLN").paymentIntentId("pi_paid").build();
        PaymentIntent intent = new PaymentIntent(); intent.setLatestCharge("ch_paid");
        Transfer result = new Transfer(); result.setId("tr_safe");
        var oldFailure = mock(com.stripe.exception.InvalidRequestException.class);
        when(oldFailure.getMessage()).thenReturn(knownGroupFailure
                ? "You cannot use `transfer_group` if the `source_transaction` already has one set."
                : "A different request was rejected");
        var newKeyCalls = new java.util.concurrent.atomic.AtomicInteger();
        var replays = new java.util.concurrent.atomic.AtomicInteger();
        try (var intents = mockStatic(PaymentIntent.class); var transfers = mockStatic(Transfer.class)) {
            intents.when(() -> PaymentIntent.retrieve("pi_paid")).thenReturn(intent);
            transfers.when(() -> Transfer.create(any(TransferCreateParams.class), any(RequestOptions.class)))
                    .thenAnswer(call -> {
                        TransferCreateParams params = call.getArgument(0);
                        RequestOptions options = call.getArgument(1);
                        if (options.getIdempotencyKey().endsWith("-source-group-v2")) {
                            newKeyCalls.incrementAndGet();
                            assertNull(params.getTransferGroup());
                            assertEquals("ch_paid", params.getSourceTransaction());
                            return result;
                        }
                        assertEquals("booking-payout-" + id, options.getIdempotencyKey());
                        if (params.getTransferGroup() == null) throw new com.stripe.exception.IdempotencyException("conflict", null, null, 400);
                        assertEquals(id.toString(), params.getTransferGroup());
                        replays.incrementAndGet();
                        if (alreadyPaid) return result;
                        throw oldFailure;
                    });
            if (alreadyPaid || knownGroupFailure) assertEquals("tr_safe", service.transferToSeller(booking, "acct_owner"));
            else assertThrows(com.stripe.exception.InvalidRequestException.class, () -> service.transferToSeller(booking, "acct_owner"));
            assertEquals(1, replays.get());
            assertEquals(!alreadyPaid && knownGroupFailure ? 1 : 0, newKeyCalls.get());
        }
    }
}
