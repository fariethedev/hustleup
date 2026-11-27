package com.hustleup.marketplace.shipping;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import java.time.Duration;
@Component
public class InPostClient {
    private final RestClient http;
    private final String token;
    private final String organization;
    public InPostClient(@Value("${app.inpost.token:}") String token,
                        @Value("${app.inpost.organization-id:}") String organization) {
        var factory = new JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.http = RestClient.builder().baseUrl("https://api-shipx-pl.easypack24.net/v1")
                .requestFactory(factory).build();
        this.token=token; this.organization=organization;
    }
    public boolean configured() { return !token.isBlank() && organization.matches("[0-9]+"); }
    public record Evidence(JsonNode shipment, JsonNode tracking) {}
    public Evidence fetch(String tracking) {
        if (!configured()) throw new IllegalStateException("InPost credentials not configured");
        if (tracking == null || !tracking.matches("[0-9]{24}")) throw new IllegalArgumentException("Invalid InPost tracking number");
        JsonNode list = http.get().uri("/organizations/{id}/shipments?tracking_number={tracking}", organization, tracking)
                .header("Authorization", "Bearer " + token).retrieve().body(JsonNode.class);
        if (list == null || !list.path("items").isArray() || list.path("items").size()!=1)
            throw new IllegalStateException("Shipment is not uniquely associated with the platform InPost account");
        JsonNode history = http.get().uri("/tracking/{tracking}", tracking).retrieve().body(JsonNode.class);
        return new Evidence(list.path("items").get(0), history);
    }
}
