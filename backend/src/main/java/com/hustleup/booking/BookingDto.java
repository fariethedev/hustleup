package com.hustleup.booking;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BookingDto {
    private UUID id;
    private UUID buyerId;
    private String buyerName;
    private UUID sellerId;
    private String sellerName;
    private UUID listingId;
    private String listingTitle;
    private BigDecimal offeredPrice;
    private BigDecimal counterPrice;
    private BigDecimal agreedPrice;
    private String currency;
    private LocalDateTime scheduledAt;
    private String status;
    private String cancelReason;
    private LocalDateTime createdAt;

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
                .status(booking.getStatus().name())
                .cancelReason(booking.getCancelReason())
                .createdAt(booking.getCreatedAt())
                .build();
    }
}
