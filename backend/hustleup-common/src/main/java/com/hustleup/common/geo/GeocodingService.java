/**
 * Turns a free-text city/address (as sellers already type into their profile) into
 * approximate coordinates via the Google Geocoding API, so the frontend can compute
 * "X km away" between a buyer and seller.
 *
 * <p>If {@code app.google.maps-server-key} is blank (the default until configured),
 * {@link #geocode} always returns empty — the distance feature simply doesn't show
 * anything rather than breaking profile updates.
 */
package com.hustleup.common.geo;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class GeocodingService {

    public record Coordinates(double lat, double lng) {}

    private final String serverKey;
    private final RestTemplate restTemplate = new RestTemplate();

    public GeocodingService(@Value("${app.google.maps-server-key:}") String serverKey) {
        this.serverKey = serverKey;
    }

    /**
     * @param address free-text address/city, e.g. "Warszawa" or "Krakowskie Przedmieście, Warszawa"
     * @return coordinates for the first match, or empty if not configured / no match / the call failed
     */
    @SuppressWarnings("unchecked")
    public Optional<Coordinates> geocode(String address) {
        if (serverKey == null || serverKey.isBlank() || address == null || address.isBlank()) {
            return Optional.empty();
        }
        try {
            String url = UriComponentsBuilder.fromUriString("https://maps.googleapis.com/maps/api/geocode/json")
                    .queryParam("address", address)
                    .queryParam("key", serverKey)
                    .toUriString();
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null || !"OK".equals(response.get("status"))) {
                return Optional.empty();
            }
            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) {
                return Optional.empty();
            }
            Map<String, Object> geometry = (Map<String, Object>) results.get(0).get("geometry");
            Map<String, Object> location = (Map<String, Object>) geometry.get("location");
            double lat = ((Number) location.get("lat")).doubleValue();
            double lng = ((Number) location.get("lng")).doubleValue();
            return Optional.of(new Coordinates(lat, lng));
        } catch (Exception e) {
            log.warn("Geocoding failed for \"{}\": {}", address, e.getMessage());
            return Optional.empty();
        }
    }
}
