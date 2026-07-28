package com.hustleup.marketplace.availability.dto;

import com.hustleup.marketplace.availability.model.Availability;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AvailabilityDto {

    private UUID id;
    private UUID listingId;
    private String listingTitle; // resolved by the service layer for the "my slots" dashboard view
    private UUID sellerId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean booked;
    private LocalDateTime createdAt;

    public static AvailabilityDto fromEntity(Availability a) {
        return AvailabilityDto.builder()
                .id(a.getId())
                .listingId(a.getListingId())
                .sellerId(a.getSellerId())
                .startTime(a.getStartTime())
                .endTime(a.getEndTime())
                .booked(a.isBooked())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
