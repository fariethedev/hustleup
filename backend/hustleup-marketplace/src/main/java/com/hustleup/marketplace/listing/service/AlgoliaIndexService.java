package com.hustleup.marketplace.listing.service;

import com.algolia.api.SearchClient;
import com.hustleup.marketplace.listing.model.Listing;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

/**
 * Pushes listings into Algolia's "listings" index so the frontend can offer instant,
 * typo-tolerant search instead of the naive client-side substring filter it falls back to.
 *
 * No-op until ALGOLIA_APP_ID/ALGOLIA_ADMIN_KEY are configured — indexing calls are best-effort
 * and never allowed to break a listing create/update/delete request.
 */
@Slf4j
@Service
public class AlgoliaIndexService {

    private static final String INDEX_NAME = "listings";

    private final String appId;
    private final String adminKey;
    private SearchClient client;

    public AlgoliaIndexService(@Value("${app.algolia.app-id:}") String appId,
                                @Value("${app.algolia.admin-key:}") String adminKey) {
        this.appId = appId;
        this.adminKey = adminKey;
    }

    @PostConstruct
    void init() {
        if (isConfigured()) {
            client = new SearchClient(appId, adminKey);
        } else {
            log.info("Algolia not configured — listing search indexing disabled (set ALGOLIA_APP_ID/ALGOLIA_ADMIN_KEY to enable)");
        }
    }

    private boolean isConfigured() {
        return appId != null && !appId.isBlank() && adminKey != null && !adminKey.isBlank();
    }

    public void indexListing(Listing listing) {
        if (client == null) return;
        try {
            client.saveObject(INDEX_NAME, toRecord(listing));
        } catch (Exception e) {
            log.warn("Algolia indexListing failed for {}: {}", listing.getId(), e.getMessage());
        }
    }

    public void deleteListing(String listingId) {
        if (client == null) return;
        try {
            client.deleteObject(INDEX_NAME, listingId);
        } catch (Exception e) {
            log.warn("Algolia deleteListing failed for {}: {}", listingId, e.getMessage());
        }
    }

    private Map<String, Object> toRecord(Listing listing) {
        Map<String, Object> record = new HashMap<>();
        record.put("objectID", listing.getId().toString());
        record.put("title", listing.getTitle());
        record.put("description", listing.getDescription());
        record.put("listingType", listing.getListingType() != null ? listing.getListingType().name() : null);
        record.put("price", listing.getPrice());
        record.put("currency", listing.getCurrency());
        record.put("locationCity", listing.getLocationCity());
        record.put("status", listing.getStatus() != null ? listing.getStatus().name() : null);
        record.put("sellerId", listing.getSellerId().toString());
        return record;
    }
}
