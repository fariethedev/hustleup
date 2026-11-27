package com.hustleup.marketplace.shipping;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
class InPostTrackingServiceTest {
    final ObjectMapper json = new ObjectMapper();
    final String tracking="123456789012345678901234", reference="shop:order", email="buyer@example.test";
    final LocalDateTime created=LocalDateTime.now().minusDays(2);
    InPostClient.Evidence evidence() {
        ObjectNode shipment=json.createObjectNode();
        shipment.put("tracking_number",tracking).put("reference",reference)
                .put("created_at",OffsetDateTime.now().minusDays(1).toString());
        shipment.putObject("receiver").put("email",email);
        ObjectNode history=json.createObjectNode();
        history.put("tracking_number",tracking).put("status","delivered");
        history.putArray("tracking_details").addObject().put("status","delivered")
                .put("datetime",OffsetDateTime.now().minusHours(1).toString());
        return new InPostClient.Evidence(shipment,history);
    }
    @Test void matchingShipmentAndDeliveryEventAreAccepted() {
        assertNotNull(InPostTrackingService.verify(evidence(),tracking,reference,email,created));
    }
    @Test void unrelatedTrackingReferenceOrRecipientCannotAuthorizeRelease() {
        var e=evidence();
        assertThrows(IllegalArgumentException.class,()->InPostTrackingService.verify(e,tracking,"shop:other",email,created));
        assertThrows(IllegalArgumentException.class,()->InPostTrackingService.verify(e,tracking,reference,"other@example.test",created));
        assertThrows(IllegalArgumentException.class,()->InPostTrackingService.verify(e,"999999999999999999999999",reference,email,created));
    }
    @Test void lockerArrivalIsNotReceipt() {
        var e=evidence(); ((ObjectNode)e.tracking()).put("status","ready_to_pickup");
        assertNull(InPostTrackingService.verify(e,tracking,reference,email,created));
    }
    @Test void deliveryRequiresAnActualTimestampedEvent() {
        var e=evidence(); ((ObjectNode)e.tracking()).putArray("tracking_details");
        assertThrows(IllegalArgumentException.class,()->InPostTrackingService.verify(e,tracking,reference,email,created));
    }
    @Test void oldShipmentsAndReturnsCannotBeReused() {
        var e=evidence();
        assertThrows(IllegalArgumentException.class,()->InPostTrackingService.verify(e,tracking,reference,email,LocalDateTime.now()));
        ((ObjectNode)e.shipment()).put("is_return",true);
        assertThrows(IllegalArgumentException.class,()->InPostTrackingService.verify(e,tracking,reference,email,created));
    }
    @Test void carrierDeliveryStillRequiresReminderAndNeverBypassesNewSellerHold() {
        Fulfilment f=new Fulfilment();
        f.setCarrierConfirmedAt(LocalDateTime.now().minusDays(8));
        f.setReleaseReminderAt(LocalDateTime.now().minusDays(3));
        assertFalse(f.automaticReleaseReady(LocalDateTime.now(),30));
        f.setBuyerConfirmationRequired(false);
        assertTrue(f.automaticReleaseReady(LocalDateTime.now(),30));
        f.setReleaseReminderAt(LocalDateTime.now());
        assertFalse(f.automaticReleaseReady(LocalDateTime.now(),30));
    }
}
