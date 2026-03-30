package com.hustleup.booking;

import com.hustleup.listing.*;
import com.hustleup.user.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    public BookingService(BookingRepository bookingRepository, ListingRepository listingRepository,
                          UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public BookingDto create(UUID listingId, BigDecimal offeredPrice, LocalDateTime scheduledAt) {
        User buyer = getCurrentUser();
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        if (listing.getSellerId().equals(buyer.getId())) {
            throw new RuntimeException("Cannot book your own listing");
        }

        Booking booking = Booking.builder()
                .buyerId(buyer.getId())
                .sellerId(listing.getSellerId())
                .listingId(listingId)
                .offeredPrice(offeredPrice != null ? offeredPrice : listing.getPrice())
                .currency(listing.getCurrency())
                .scheduledAt(scheduledAt)
                .status(BookingStatus.INQUIRED)
                .build();

        return enrichDto(bookingRepository.save(booking));
    }

    @Transactional
    public BookingDto counterOffer(UUID bookingId, BigDecimal counterPrice) {
        User seller = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("Only the seller can counter-offer");
        }

        booking.setCounterPrice(counterPrice);
        booking.setStatus(BookingStatus.NEGOTIATING);
        booking.setUpdatedAt(LocalDateTime.now());
        return enrichDto(bookingRepository.save(booking));
    }

    @Transactional
    public BookingDto accept(UUID bookingId) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getBuyerId().equals(user.getId()) && !booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }

        try {
            BigDecimal agreed = booking.getCounterPrice() != null ?
                    booking.getCounterPrice() : booking.getOfferedPrice();
            booking.setAgreedPrice(agreed);
            booking.setStatus(BookingStatus.BOOKED);
            booking.setUpdatedAt(LocalDateTime.now());
            return enrichDto(bookingRepository.save(booking));
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new RuntimeException("This booking was just updated — please refresh and try again");
        }
    }

    @Transactional
    public BookingDto cancel(UUID bookingId, String reason) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getBuyerId().equals(user.getId()) && !booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelReason(reason);
        booking.setUpdatedAt(LocalDateTime.now());
        return enrichDto(bookingRepository.save(booking));
    }

    @Transactional
    public BookingDto complete(UUID bookingId) {
        User user = getCurrentUser();
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getSellerId().equals(user.getId())) {
            throw new RuntimeException("Only seller can mark as completed");
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setUpdatedAt(LocalDateTime.now());
        return enrichDto(bookingRepository.save(booking));
    }

    public List<BookingDto> getMyBookings() {
        User user = getCurrentUser();
        List<Booking> bookings;
        if (user.getRole() == com.hustleup.user.Role.SELLER) {
            bookings = bookingRepository.findBySellerIdOrderByCreatedAtDesc(user.getId());
        } else {
            bookings = bookingRepository.findByBuyerIdOrderByCreatedAtDesc(user.getId());
        }
        // Also include bookings where user is on the other side
        List<Booking> otherSide = user.getRole() == com.hustleup.user.Role.SELLER ?
                bookingRepository.findByBuyerIdOrderByCreatedAtDesc(user.getId()) :
                bookingRepository.findBySellerIdOrderByCreatedAtDesc(user.getId());
        bookings.addAll(otherSide);
        return bookings.stream().distinct().map(this::enrichDto).collect(Collectors.toList());
    }

    private BookingDto enrichDto(Booking booking) {
        BookingDto dto = BookingDto.fromEntity(booking);
        userRepository.findById(booking.getBuyerId()).ifPresent(u -> dto.setBuyerName(u.getFullName()));
        userRepository.findById(booking.getSellerId()).ifPresent(u -> dto.setSellerName(u.getFullName()));
        listingRepository.findById(booking.getListingId()).ifPresent(l -> dto.setListingTitle(l.getTitle()));
        return dto;
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
