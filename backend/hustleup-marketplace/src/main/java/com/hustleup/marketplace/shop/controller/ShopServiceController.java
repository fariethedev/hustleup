/**
 * Booking API for an appointment-based shop: the owner's menu of services, the time slots
 * they open against each one, and the appointments customers make.
 *
 * <p>Kept separate from {@link ShopController} (which already owns {@code /api/v1/shops})
 * rather than folded into it: that file is already the shop's own read/write surface plus its
 * product catalogue, and appointments are a large enough feature — three entities, a booking
 * flow with its own validation — to earn their own file the way {@link ShopOrderController}
 * already does for storefront checkout.
 *
 * <p>Ownership is enforced the same way as {@code ShopController.requireOwned}: every write
 * to a service or a slot re-resolves the shop and checks the caller owns it, rather than
 * trusting that the client only shows edit controls to the owner.
 */
package com.hustleup.marketplace.shop.controller;

import com.hustleup.common.model.Notification;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.NotificationRepository;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.security.EmailVerificationGuard;
import com.hustleup.marketplace.shop.dto.*;
import com.hustleup.marketplace.shop.model.Shop;
import com.hustleup.marketplace.shop.model.ShopAppointment;
import com.hustleup.marketplace.shop.model.ShopBookableService;
import com.hustleup.marketplace.shop.model.ShopServiceSlot;
import com.hustleup.marketplace.shop.repository.ShopAppointmentRepository;
import com.hustleup.marketplace.shop.repository.ShopBookableServiceRepository;
import com.hustleup.marketplace.shop.repository.ShopRepository;
import com.hustleup.marketplace.shop.repository.ShopServiceSlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/shops")
@RequiredArgsConstructor
@Slf4j
public class ShopServiceController {

    private final ShopRepository shopRepository;
    private final ShopBookableServiceRepository serviceRepository;
    private final ShopServiceSlotRepository slotRepository;
    private final ShopAppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final EmailVerificationGuard emailVerificationGuard;

    // -------------------------------------------------------------------------
    // Identity / ownership — mirrors ShopController exactly; see its own Javadoc.
    // -------------------------------------------------------------------------

    private User currentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return null;
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }

    private User requireUser() {
        User user = currentUserOrNull();
        if (user == null) throw new AccessDeniedException("Authentication required");
        return user;
    }

    private Optional<Shop> resolve(String idOrSlug) {
        try {
            return shopRepository.findById(UUID.fromString(idOrSlug));
        } catch (IllegalArgumentException notAUuid) {
            return shopRepository.findBySlug(idOrSlug);
        }
    }

    private Shop requireShop(String idOrSlug) {
        return resolve(idOrSlug).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shop not found"));
    }

    private Shop requireOwned(String idOrSlug) {
        User me = requireUser();
        Shop shop = requireShop(idOrSlug);
        if (!shop.getOwnerId().equals(me.getId())) {
            throw new AccessDeniedException("You can only manage your own shop");
        }
        return shop;
    }

    private ShopBookableService requireServiceOf(Shop shop, UUID serviceId) {
        ShopBookableService service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
        if (!service.getShopId().equals(shop.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found");
        }
        return service;
    }

    // -------------------------------------------------------------------------
    // Services (owner's menu)
    // -------------------------------------------------------------------------

    /**
     * A shop's menu of bookable services. Public, like the product catalogue — a buyer has to
     * see what's on offer before they can book any of it. An inactive service is only shown
     * back to its own owner (managing something you can't see is not manageable), same
     * reasoning as {@code ShopController.getOne} hiding an unpublished shop from everyone else.
     */
    @GetMapping("/{idOrSlug}/services")
    public ResponseEntity<List<ShopBookableServiceDto>> listServices(@PathVariable String idOrSlug) {
        Shop shop = requireShop(idOrSlug);
        User me = currentUserOrNull();
        boolean isOwner = me != null && shop.getOwnerId().equals(me.getId());
        List<ShopBookableService> services = isOwner
                ? serviceRepository.findByShopIdOrderBySortOrderAsc(shop.getId())
                : serviceRepository.findByShopIdAndActiveTrueOrderBySortOrderAsc(shop.getId());
        return ResponseEntity.ok(services.stream().map(ShopBookableServiceDto::from).collect(Collectors.toList()));
    }

    @PostMapping("/{idOrSlug}/services")
    public ResponseEntity<ShopBookableServiceDto> addService(
            @PathVariable String idOrSlug, @RequestBody ShopBookableServiceRequest body) {
        Shop shop = requireOwned(idOrSlug);
        User me = requireUser();
        // A service invites a customer to book time with this seller directly, so — same as
        // opening a marketplace availability slot — this is the point a reachable address
        // starts mattering, not every later read of a menu the seller already published.
        emailVerificationGuard.require(me, "add a bookable service");

        String name = trimToNull(body.getName());
        if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service name is required");
        if (body.getDurationMinutes() == null || body.getDurationMinutes() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be at least one minute");
        }
        if (body.getPrice() == null || body.getPrice().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price must be zero or more");
        }

        ShopBookableService service = ShopBookableService.builder()
                .shopId(shop.getId())
                .name(name)
                .description(trimToNull(body.getDescription()))
                .durationMinutes(body.getDurationMinutes())
                .price(body.getPrice())
                .currency(trimToNull(body.getCurrency()) == null ? "PLN" : body.getCurrency().trim())
                .active(body.getActive() == null || body.getActive())
                .sortOrder(body.getSortOrder() != null
                        ? body.getSortOrder()
                        : (int) serviceRepository.countByShopId(shop.getId()))
                .build();

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ShopBookableServiceDto.from(serviceRepository.save(service)));
    }

    @PatchMapping("/{idOrSlug}/services/{serviceId}")
    public ResponseEntity<ShopBookableServiceDto> updateService(
            @PathVariable String idOrSlug, @PathVariable UUID serviceId,
            @RequestBody ShopBookableServiceRequest body) {
        Shop shop = requireOwned(idOrSlug);
        ShopBookableService service = requireServiceOf(shop, serviceId);

        if (body.getName() != null) {
            String name = trimToNull(body.getName());
            if (name == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service name cannot be empty");
            service.setName(name);
        }
        if (body.getDescription() != null) service.setDescription(trimToNull(body.getDescription()));
        if (body.getDurationMinutes() != null) {
            if (body.getDurationMinutes() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duration must be at least one minute");
            }
            service.setDurationMinutes(body.getDurationMinutes());
        }
        if (body.getPrice() != null) {
            if (body.getPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Price must be zero or more");
            }
            service.setPrice(body.getPrice());
        }
        if (body.getCurrency() != null) service.setCurrency(trimToNull(body.getCurrency()));
        if (body.getActive() != null) service.setActive(body.getActive());
        if (body.getSortOrder() != null) service.setSortOrder(body.getSortOrder());

        return ResponseEntity.ok(ShopBookableServiceDto.from(serviceRepository.save(service)));
    }

    /**
     * Deletes a service outright. Refused once any slot against it has ever been booked —
     * deleting it would strand the appointment's shopServiceId reference (and, for an upcoming
     * one, quietly cancel a customer's booking with no record of why). Retiring a service
     * without erasing its history is what {@code active=false} (via update) is for.
     */
    @DeleteMapping("/{idOrSlug}/services/{serviceId}")
    public ResponseEntity<Void> deleteService(@PathVariable String idOrSlug, @PathVariable UUID serviceId) {
        Shop shop = requireOwned(idOrSlug);
        ShopBookableService service = requireServiceOf(shop, serviceId);
        if (slotRepository.existsByShopServiceIdAndBookedTrue(service.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This service has booked appointments — turn it off instead of deleting it");
        }
        // Free the unbooked slots along with it; nothing else references them.
        slotRepository.findByShopServiceIdOrderByStartTimeAsc(service.getId()).forEach(slotRepository::delete);
        serviceRepository.delete(service);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Slots (owner opens them; anyone can read them to book)
    // -------------------------------------------------------------------------

    /**
     * Every slot — open and booked — for one service, so a customer's picker can grey out
     * what's already taken instead of just omitting it. Mirrors
     * {@code AvailabilityController.byListing} exactly.
     */
    @GetMapping("/{idOrSlug}/services/{serviceId}/slots")
    public ResponseEntity<List<ShopServiceSlotDto>> listSlots(
            @PathVariable String idOrSlug, @PathVariable UUID serviceId) {
        Shop shop = requireShop(idOrSlug);
        requireServiceOf(shop, serviceId);
        return ResponseEntity.ok(slotRepository.findByShopServiceIdOrderByStartTimeAsc(serviceId)
                .stream().map(ShopServiceSlotDto::from).collect(Collectors.toList()));
    }

    @PostMapping("/{idOrSlug}/services/{serviceId}/slots")
    public ResponseEntity<ShopServiceSlotDto> addSlot(
            @PathVariable String idOrSlug, @PathVariable UUID serviceId,
            @RequestBody Map<String, String> body) {
        Shop shop = requireOwned(idOrSlug);
        ShopBookableService service = requireServiceOf(shop, serviceId);

        LocalDateTime start;
        LocalDateTime end;
        try {
            start = LocalDateTime.parse(body.get("startTime"));
            end = LocalDateTime.parse(body.get("endTime"));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startTime and endTime must be ISO-8601");
        }
        if (!end.isAfter(start)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A slot must end after it starts");
        }

        ShopServiceSlot slot = ShopServiceSlot.builder()
                .shopServiceId(service.getId())
                .shopId(shop.getId())
                .startTime(start)
                .endTime(end)
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(ShopServiceSlotDto.from(slotRepository.save(slot)));
    }

    /** Every slot the owner has opened across their whole calendar — powers the manager UI. */
    @GetMapping("/{idOrSlug}/services/slots")
    public ResponseEntity<List<ShopServiceSlotDto>> myShopSlots(@PathVariable String idOrSlug) {
        Shop shop = requireOwned(idOrSlug);
        Map<UUID, String> names = serviceRepository.findByShopIdOrderBySortOrderAsc(shop.getId()).stream()
                .collect(Collectors.toMap(ShopBookableService::getId, ShopBookableService::getName));
        return ResponseEntity.ok(slotRepository.findByShopIdOrderByStartTimeAsc(shop.getId()).stream()
                .map(s -> {
                    ShopServiceSlotDto dto = ShopServiceSlotDto.from(s);
                    dto.setServiceName(names.get(s.getShopServiceId()));
                    return dto;
                }).collect(Collectors.toList()));
    }

    @DeleteMapping("/{idOrSlug}/services/slots/{slotId}")
    public ResponseEntity<Void> deleteSlot(@PathVariable String idOrSlug, @PathVariable UUID slotId) {
        Shop shop = requireOwned(idOrSlug);
        ShopServiceSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Slot not found"));
        if (!slot.getShopId().equals(shop.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Slot not found");
        }
        if (slot.isBooked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete a booked slot — cancel the appointment first");
        }
        slotRepository.delete(slot);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------------------------
    // Appointments
    // -------------------------------------------------------------------------

    /**
     * Books an open slot.
     *
     * <p><b>No payment is taken here.</b> An appointment is a reservation of the owner's
     * time, not a charge — see {@link ShopAppointment}'s own Javadoc for why. What this
     * endpoint actually guarantees is the part that matters: the slot cannot be double-booked,
     * and the owner is notified without needing to be watching for it.
     *
     * <p>Body: {@code { slotId, customer: { fullName, email, phone }, notes }} — same shape as
     * {@link ShopOrderController#checkout}'s {@code customer} object, for one consistent
     * "who is this for" contract across both booking flows.
     */
    @PostMapping("/{idOrSlug}/appointments")
    public ResponseEntity<ShopAppointmentDto> book(@PathVariable String idOrSlug, @RequestBody Map<String, Object> body) {
        Shop shop = requireShop(idOrSlug);
        User buyer = requireUser();

        UUID slotId;
        try {
            slotId = UUID.fromString(String.valueOf(body.get("slotId")));
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "slotId is required");
        }
        ShopServiceSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Slot not found"));
        if (!slot.getShopId().equals(shop.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Slot not found");
        }
        // Checked again here even though the picker should already hide booked slots — the
        // picker is what stops an honest double-click, not what stops two tabs racing to
        // book the last opening. This is the actual guard.
        if (slot.isBooked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That slot has just been booked — pick another");
        }
        ShopBookableService service = serviceRepository.findById(slot.getShopServiceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));

        @SuppressWarnings("unchecked")
        Map<String, Object> customer = (Map<String, Object>) body.getOrDefault("customer", Map.of());

        slot.setBooked(true);
        slotRepository.save(slot);

        ShopAppointment appointment = ShopAppointment.builder()
                .shopServiceId(service.getId())
                .shopId(shop.getId())
                .slotId(slot.getId())
                .buyerId(buyer.getId())
                .customerName(str(customer.get("fullName")) != null ? str(customer.get("fullName")) : buyer.displayName())
                .customerEmail(str(customer.get("email")) != null ? str(customer.get("email")) : buyer.getEmail())
                .customerPhone(str(customer.get("phone")))
                .notes(str(body.get("notes")))
                .serviceName(service.getName())
                .price(service.getPrice())
                .currency(service.getCurrency())
                .build();
        appointment = appointmentRepository.save(appointment);

        notify(shop.getOwnerId(), "New appointment booked",
                appointment.getCustomerName() + " booked " + service.getName() + " for "
                        + slot.getStartTime().toLocalDate() + " at "
                        + slot.getStartTime().toLocalTime());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ShopAppointmentDto.from(appointment, slot.getStartTime(), slot.getEndTime(), shop.getName()));
    }

    /** The shop owner's own calendar of bookings — powers ShopManager's Appointments panel. */
    @GetMapping("/{idOrSlug}/appointments")
    public ResponseEntity<List<ShopAppointmentDto>> received(@PathVariable String idOrSlug) {
        Shop shop = requireOwned(idOrSlug);
        return ResponseEntity.ok(withSlotTimes(appointmentRepository.findByShopIdOrderByCreatedAtDesc(shop.getId()), shop.getName()));
    }

    /** Everything the caller themselves has booked, across every shop — for their own view of it. */
    @GetMapping("/appointments/mine")
    public ResponseEntity<List<ShopAppointmentDto>> mine() {
        User me = requireUser();
        List<ShopAppointment> appointments = appointmentRepository.findByBuyerIdOrderByCreatedAtDesc(me.getId());
        Map<UUID, String> shopNames = shopRepository.findAllById(
                appointments.stream().map(ShopAppointment::getShopId).distinct().toList()
        ).stream().collect(Collectors.toMap(Shop::getId, Shop::getName));
        return ResponseEntity.ok(appointments.stream().map(a -> {
            LocalDateTime start = null, end = null;
            var slot = slotRepository.findById(a.getSlotId()).orElse(null);
            if (slot != null) { start = slot.getStartTime(); end = slot.getEndTime(); }
            return ShopAppointmentDto.from(a, start, end, shopNames.get(a.getShopId()));
        }).collect(Collectors.toList()));
    }

    /**
     * Owner-side status change: mark a completed visit, a no-show, or cancel outright. A
     * cancellation frees the slot back up; the other two states leave it booked, since the
     * time genuinely was spent one way or the other.
     */
    @PatchMapping("/{idOrSlug}/appointments/{appointmentId}")
    public ResponseEntity<ShopAppointmentDto> updateStatus(
            @PathVariable String idOrSlug, @PathVariable UUID appointmentId, @RequestBody Map<String, String> body) {
        Shop shop = requireOwned(idOrSlug);
        ShopAppointment appointment = requireAppointmentOf(shop.getId(), appointmentId);
        applyStatus(appointment, body.get("status"));
        appointment = appointmentRepository.save(appointment);
        var slot = slotRepository.findById(appointment.getSlotId()).orElse(null);
        return ResponseEntity.ok(ShopAppointmentDto.from(
                appointment, slot != null ? slot.getStartTime() : null, slot != null ? slot.getEndTime() : null, shop.getName()));
    }

    /** The customer cancelling their own appointment — frees the slot for someone else. */
    @PatchMapping("/appointments/{appointmentId}/cancel")
    public ResponseEntity<Void> cancelMine(@PathVariable UUID appointmentId) {
        User me = requireUser();
        ShopAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        if (!appointment.getBuyerId().equals(me.getId())) {
            throw new AccessDeniedException("You can only cancel your own appointment");
        }
        applyStatus(appointment, "CANCELLED");
        appointmentRepository.save(appointment);

        Shop shop = shopRepository.findById(appointment.getShopId()).orElse(null);
        if (shop != null) {
            notify(shop.getOwnerId(), "Appointment cancelled",
                    (appointment.getCustomerName() != null ? appointment.getCustomerName() : "A customer")
                            + " cancelled their " + appointment.getServiceName() + " booking.");
        }
        return ResponseEntity.noContent().build();
    }

    private void applyStatus(ShopAppointment appointment, String raw) {
        ShopAppointment.Status status;
        try {
            status = ShopAppointment.Status.valueOf(String.valueOf(raw).toUpperCase());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unrecognised status");
        }
        if (status == ShopAppointment.Status.CANCELLED && appointment.getStatus() != ShopAppointment.Status.CANCELLED) {
            slotRepository.findById(appointment.getSlotId()).ifPresent(s -> {
                s.setBooked(false);
                slotRepository.save(s);
            });
        }
        appointment.setStatus(status);
    }

    private ShopAppointment requireAppointmentOf(UUID shopId, UUID appointmentId) {
        ShopAppointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        if (!appointment.getShopId().equals(shopId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found");
        }
        return appointment;
    }

    private List<ShopAppointmentDto> withSlotTimes(List<ShopAppointment> appointments, String shopName) {
        return appointments.stream().map(a -> {
            var slot = slotRepository.findById(a.getSlotId()).orElse(null);
            return ShopAppointmentDto.from(a, slot != null ? slot.getStartTime() : null,
                    slot != null ? slot.getEndTime() : null, shopName);
        }).collect(Collectors.toList());
    }

    /** A notification that fails to save must never roll back a booking that succeeded. */
    private void notify(UUID userId, String title, String message) {
        try {
            notificationRepository.save(Notification.builder()
                    .userId(userId)
                    .title(title)
                    .message(message)
                    .notificationType("APPOINTMENT")
                    .build());
        } catch (Exception e) {
            log.warn("Could not notify {} about an appointment: {}", userId, e.getMessage());
        }
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String str(Object v) {
        return v != null && !String.valueOf(v).isBlank() ? String.valueOf(v) : null;
    }
}
