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
}
