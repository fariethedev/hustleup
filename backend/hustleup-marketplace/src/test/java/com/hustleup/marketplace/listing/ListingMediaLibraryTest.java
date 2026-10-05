package com.hustleup.marketplace.listing;

import com.hustleup.marketplace.listing.model.ListingType;
import com.hustleup.marketplace.listing.service.ListingMediaLibrary;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ListingMediaLibraryTest {
    @Test void neverPadsAnEmptyOrSinglePhotoListing() {
        var library = new ListingMediaLibrary();
        assertEquals("", library.padToMinimum(null, ListingType.GOODS, "seed"));
        assertEquals("https://seller.example/own.jpg", library.padToMinimum("https://seller.example/own.jpg", ListingType.GOODS, "seed"));
        assertFalse(library.needsPadding(null));
    }
    @Test void recognizesOnlyExactHistoricalPadding() {
        assertTrue(ListingMediaLibrary.isGeneratedPadding("https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80"));
        assertFalse(ListingMediaLibrary.isGeneratedPadding("https://seller.example/own.jpg"));
        assertFalse(ListingMediaLibrary.isGeneratedPadding("https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800"));
    }
}
