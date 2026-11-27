package com.hustleup.marketplace.shipping;

/**
 * What an order is for, as shown in its emails: the item's name and photo, and the price
 * already formatted (see {@code com.hustleup.common.util.Money}). Shared by marketplace
 * bookings and storefront orders so both confirmations look the same.
 *
 * @param imageUrl absolute https URL of the item photo, or null to show no picture
 * @param priceText e.g. "120 PLN" — null hides the price pill
 */
public record OrderSummary(String itemName, String imageUrl, String priceText, int quantity) {
    public static OrderSummary of(String itemName) {
        return new OrderSummary(itemName, null, null, 1);
    }

    public String detail() {
        return quantity > 1 ? "Quantity: " + quantity : null;
    }
}
