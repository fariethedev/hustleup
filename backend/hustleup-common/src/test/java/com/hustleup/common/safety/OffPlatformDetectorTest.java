package com.hustleup.common.safety;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class OffPlatformDetectorTest {
    @Test void flagsPaymentOutsideTheApp() {
        assertEquals(OffPlatformDetector.OFF_PLATFORM_PAYMENT, OffPlatformDetector.classify("Can you pay by BLIK instead?"));
        assertEquals(OffPlatformDetector.OFF_PLATFORM_PAYMENT, OffPlatformDetector.classify("Zrób przelew na moje konto"));
        assertEquals(OffPlatformDetector.OFF_PLATFORM_PAYMENT, OffPlatformDetector.classify("pay outside the app, it's cheaper"));
    }

    @Test void flagsContactSharing() {
        assertEquals(OffPlatformDetector.CONTACT_SHARING, OffPlatformDetector.classify("text me on WhatsApp"));
        assertEquals(OffPlatformDetector.CONTACT_SHARING, OffPlatformDetector.classify("my number is 512 345 678"));
    }

    @Test void leavesOrdinaryMessagesAlone() {
        assertNull(OffPlatformDetector.classify("Is it still available? Can I pick it up tomorrow?"));
        assertNull(OffPlatformDetector.classify(null));
    }
}
