/**
 * Data Transfer Object (DTO) for a {@link Booking} entity.
 *
 * <p>The DTO is the shape of the JSON object that the API sends to and receives from clients.
 * It differs from the entity in two important ways:
 * <ol>
 *   <li><b>Extra display fields</b> — {@code buyerName}, {@code sellerName}, and
 *       {@code listingTitle} are not stored on the Booking entity; they are resolved by
 *       the service layer by looking up the related User and Listing records.</li>
 *   <li><b>Status as String</b> — {@link com.hustleup.booking.model.BookingStatus} is serialised
 *       to its name (e.g. {@code "BOOKED"}) so JSON clients don't need to know the Java enum
 *       ordinal values.</li>
 * </ol>
 *
 * <p>This class is intentionally a pure data holder with no business logic. The only code here
 * is the static factory method {@link #fromEntity} which performs the entity → DTO mapping.
 */
package com.hustleup.booking.dto;

import com.hustleup.booking.model.Booking;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

// Lombok annotations generate getters, setters, constructors, and a builder at compile time.
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BookingDto {

    // --- Identity ---
    private UUID id; // unique identifier of this booking

    // --- Buyer info ---
    private UUID buyerId;     // UUID of the buyer, mirrored from the entity
    private String buyerName; // resolved display name (not stored on entity — added by service)

    // --- Seller info ---
    private UUID sellerId;     // UUID of the seller, mirrored from the entity
    private String sellerName; // resolved display name (not stored on entity — added by service)

    // --- Linked listing ---
    private UUID listingId;      // UUID of the listing that was booked
    private String listingTitle; // resolved listing headline (not stored on entity — added by service)

    // --- Three-price negotiation trail ---
    private BigDecimal offeredPrice;  // buyer's opening offer (may equal listing price if not customised)
    private BigDecimal counterPrice;  // seller's counter-proposal (null until NEGOTIATING state)
    private BigDecimal agreedPrice;   // final price both parties agreed on (null until BOOKED state)
    private String currency;          // ISO 4217 code (e.g. "GBP")

    // --- Schedule ---
    private LocalDateTime scheduledAt; // when the service is to be delivered; null if not specified

    // --- Status ---
    private String status;        // BookingStatus.name() — e.g. "BOOKED", "CANCELLED"
    private String cancelReason;  // reason provided at cancellation time; null for non-cancelled bookings

    // --- Viewer role ---
    private String role; // "buyer" or "seller" — set relative to the authenticated user who fetched this DTO

    // --- Timestamps ---
    private LocalDateTime createdAt; // when the booking was first created

    /**
     * Converts a {@link Booking} entity into a {@code BookingDto}.
     *
     * <p>Note that {@code buyerName}, {@code sellerName}, and {@code listingTitle} are NOT
     * populated by this factory method — they require additional database lookups and are
     * set separately in {@link com.hustleup.booking.service.BookingService#enrichDto}.
     *
     * @param booking the entity read from the database
     * @return a DTO with all scalar entity fields copied across; display-name fields are null
     */
    public static BookingDto fromEntity(Booking booking) {
        return BookingDto.builder()
                .id(booking.getId())
                .buyerId(booking.getBuyerId())
                .sellerId(booking.getSellerId())
                .listingId(booking.getListingId())
                .offeredPrice(booking.getOfferedPrice())
                .counterPrice(booking.getCounterPrice())
                .agreedPrice(booking.getAgreedPrice())
                .currency(booking.getCurrency())
                .scheduledAt(booking.getScheduledAt())
                // .name() converts the enum constant to its string representation
                .status(booking.getStatus().name())
                .cancelReason(booking.getCancelReason())
                .createdAt(booking.getCreatedAt())
                .build();
    }
}
