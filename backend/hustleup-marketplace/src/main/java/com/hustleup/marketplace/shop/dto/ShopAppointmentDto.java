package com.hustleup.marketplace.shop.dto;

import com.hustleup.marketplace.shop.model.ShopAppointment;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/** A booked appointment, as sent to either side of it. */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ShopAppointmentDto {

    private UUID id;
    private UUID shopServiceId;
    private UUID shopId;
    private String shopName;
    private UUID slotId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private UUID buyerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String notes;
    private String serviceName;
    private BigDecimal price;
    private String currency;
    private String status;
    private LocalDateTime createdAt;

    /**
     * @param startTime end/start come from the slot, not the appointment row itself — see
     *                  ShopServiceController, which resolves them from the linked slot.
     */
    public static ShopAppointmentDto from(ShopAppointment a, LocalDateTime startTime, LocalDateTime endTime, String shopName) {
        if (a == null) return new ShopAppointmentDto();
        return ShopAppointmentDto.builder()
                .id(a.getId())
                .shopServiceId(a.getShopServiceId())
                .shopId(a.getShopId())
                .shopName(shopName)
                .slotId(a.getSlotId())
                .startTime(startTime)
                .endTime(endTime)
                .buyerId(a.getBuyerId())
                .customerName(a.getCustomerName())
                .customerEmail(a.getCustomerEmail())
                .customerPhone(a.getCustomerPhone())
                .notes(a.getNotes())
                .serviceName(a.getServiceName())
                .price(a.getPrice())
                .currency(a.getCurrency())
                .status(a.getStatus().name())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
