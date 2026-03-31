package com.hustleup.booking.controller;

import com.hustleup.booking.dto.BookingDto;
import com.hustleup.booking.service.BookingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    public ResponseEntity<BookingDto> create(@RequestBody Map<String, Object> body) {
        UUID listingId = UUID.fromString((String) body.get("listingId"));
        BigDecimal offeredPrice = body.containsKey("offeredPrice") ?
                new BigDecimal(body.get("offeredPrice").toString()) : null;
        LocalDateTime scheduledAt = body.containsKey("scheduledAt") ?
                LocalDateTime.parse((String) body.get("scheduledAt")) : null;
        return ResponseEntity.ok(bookingService.create(listingId, offeredPrice, scheduledAt));
    }

    @PatchMapping("/{id}/counter")
    public ResponseEntity<BookingDto> counterOffer(@PathVariable UUID id,
                                                    @RequestBody Map<String, Object> body) {
        BigDecimal counterPrice = new BigDecimal(body.get("counterPrice").toString());
        return ResponseEntity.ok(bookingService.counterOffer(id, counterPrice));
    }

    @PatchMapping("/{id}/accept")
    public ResponseEntity<BookingDto> accept(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.accept(id));
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<BookingDto> cancel(@PathVariable UUID id,
                                              @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(bookingService.cancel(id, reason));
    }

    @PatchMapping("/{id}/complete")
    public ResponseEntity<BookingDto> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.complete(id));
    }

    @GetMapping("/my")
    public ResponseEntity<List<BookingDto>> myBookings() {
        return ResponseEntity.ok(bookingService.getMyBookings());
    }
}
