package com.hustleup.common.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MoneyTest {
    @Test void dropsZeroCentsThatTheDatabaseScaleAdds() {
        assertEquals("120 PLN", Money.format(new BigDecimal("120.0000"), "PLN"));
    }

    @Test void keepsRealCentsToTwoPlaces() {
        assertEquals("120.50 PLN", Money.format(new BigDecimal("120.5000"), "pln"));
        assertEquals("0.99 EUR", Money.format(new BigDecimal("0.9900"), "EUR"));
    }

    @Test void groupsThousandsAndDefaultsTheCurrency() {
        assertEquals("1,250 PLN", Money.format(new BigDecimal("1250.0000"), null));
    }

    @Test void multipliesByQuantity() {
        assertEquals("75 PLN", Money.format(new BigDecimal("25.0000"), 3, "PLN"));
    }
}
