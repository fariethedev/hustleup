package com.hustleup.marketplace.payments.controller;
import com.hustleup.marketplace.safety.DisputeService;
import com.stripe.model.*;
import com.stripe.net.Webhook;
import com.stripe.exception.SignatureVerificationException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class DisputeWebhookTest {
    final DisputeService disputes=mock(DisputeService.class);
    final PayoutController controller=new PayoutController(null,null,null,null,null,null,null,null,null,null,null,disputes);
    @Test void invalidStripeSignatureNeverReachesDisputeHandler() throws Exception {
        ReflectionTestUtils.setField(controller,"webhookSecret","secret");
        try (var signatures=mockStatic(Webhook.class)) {
            signatures.when(()->Webhook.constructEvent("payload","bad","secret"))
                    .thenThrow(new SignatureVerificationException("Invalid signature","bad"));
            assertEquals(400,controller.webhook("payload","bad").getStatusCode().value());
            verifyNoInteractions(disputes);
        }
    }
    @Test void verifiedDisputeIsHandledAndUnreadableEventRequestsRetry() throws Exception {
        ReflectionTestUtils.setField(controller,"webhookSecret","secret");
        var event=mock(Event.class); when(event.getType()).thenReturn("charge.dispute.created");
        var data=mock(EventDataObjectDeserializer.class); when(event.getDataObjectDeserializer()).thenReturn(data);
        Dispute dispute=new Dispute(); dispute.setId("dp_1"); when(data.getObject()).thenReturn(Optional.of(dispute));
        try (var signatures=mockStatic(Webhook.class)) {
            signatures.when(()->Webhook.constructEvent("payload","signature","secret")).thenReturn(event);
            assertEquals(200,controller.webhook("payload","signature").getStatusCode().value());
            verify(disputes).handle("dp_1");
            when(data.getObject()).thenReturn(Optional.of(new Charge()));
            assertEquals(500,controller.webhook("payload","signature").getStatusCode().value());
            verifyNoMoreInteractions(disputes);
        }
    }
    @Test void safetyAdminEndpointsRequireAdminRole() {
        assertEquals("hasRole('ADMIN')",com.hustleup.marketplace.safety.SafetyAdminController.class
                .getAnnotation(org.springframework.security.access.prepost.PreAuthorize.class).value());
    }
}
