package com.hustleup.marketplace.listing.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * The menu of a service listing — a barber's "Skin fade 60 / Beard trim 30 / Cut + beard 80".
 *
 * <p>Stored in the listing's {@code meta} JSON as
 * {@code {"services":[{"name","price","durationMins"}]}}, the same place event ticket tiers
 * live, so no schema change was needed. A service listing used to carry one price and one
 * description, which left a barber with five cuts at five prices to either post five
 * listings or bury the menu in the description where nobody could book from it.
 *
 * <p>Prices are always read from here on the server — a booking names the service, never
 * its price.
 */
public final class ServiceMenu {

    /** Listing types that sell time rather than things. */
    public static final Set<ListingType> SERVICE_TYPES = Set.of(ListingType.HAIR_BEAUTY, ListingType.SKILL);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public record Item(String name, BigDecimal price, Integer durationMins) {}

    private ServiceMenu() {}

    /** The menu, or an empty list when the listing has none or its meta is unreadable. */
    public static List<Item> read(String meta) {
        if (meta == null || meta.isBlank()) return Collections.emptyList();
        JsonNode services;
        try {
            services = MAPPER.readTree(meta).path("services");
        } catch (Exception unreadable) {
            return Collections.emptyList();
        }
        if (!services.isArray()) return Collections.emptyList();
        List<Item> items = new ArrayList<>();
        for (JsonNode s : services) {
            String name = s.path("name").asText("").trim();
            if (name.isEmpty() || !s.path("price").isNumber() && !s.path("price").isTextual()) continue;
            BigDecimal price;
            try {
                price = new BigDecimal(s.path("price").asText());
            } catch (NumberFormatException bad) {
                continue;
            }
            if (price.signum() < 0) continue;
            int mins = s.path("durationMins").asInt(0);
            items.add(new Item(name, price, mins > 0 ? mins : null));
        }
        return items;
    }

    /** The service a buyer named, matched case-insensitively. */
    public static Optional<Item> find(String meta, String name) {
        if (name == null || name.isBlank()) return Optional.empty();
        String wanted = name.trim();
        return read(meta).stream().filter(i -> i.name().equalsIgnoreCase(wanted)).findFirst();
    }

    /** The cheapest service — what the listing's headline "from" price should be. */
    public static Optional<BigDecimal> lowestPrice(String meta) {
        return read(meta).stream().map(Item::price).min(BigDecimal::compareTo);
    }
}
