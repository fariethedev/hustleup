package com.hustleup.listing;

import com.hustleup.review.ReviewRepository;
import com.hustleup.storage.FileStorageService;
import com.hustleup.user.User;
import com.hustleup.user.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ListingService {

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final FileStorageService fileStorageService;

    public ListingService(ListingRepository listingRepository, UserRepository userRepository,
                          ReviewRepository reviewRepository, FileStorageService fileStorageService) {
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.reviewRepository = reviewRepository;
        this.fileStorageService = fileStorageService;
    }

    public List<ListingDto> getAll(ListingType type, String city, BigDecimal maxPrice, Boolean negotiable) {
        List<Listing> listings = listingRepository.findWithFilters(type, city, maxPrice, negotiable);
        return listings.stream().map(this::enrichDto).collect(Collectors.toList());
    }

    public List<ListingDto> search(String query) {
        return listingRepository.search(query).stream()
                .map(this::enrichDto).collect(Collectors.toList());
    }

    public ListingDto getById(UUID id) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));
        return enrichDto(listing);
    }

    public ListingDto create(String title, String description, String listingType, BigDecimal price,
                              String currency, boolean negotiable, String city, String meta,
                              List<MultipartFile> images) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String mediaUrlsCsv = "";
        if (images != null && !images.isEmpty()) {
            mediaUrlsCsv = images.stream()
                    .map(fileStorageService::store)
                    .collect(Collectors.joining(","));
        }

        Listing listing = Listing.builder()
                .sellerId(seller.getId())
                .title(title)
                .description(description)
                .listingType(ListingType.valueOf(listingType))
                .price(price)
                .currency(currency != null ? currency : "GBP")
                .negotiable(negotiable)
                .locationCity(city)
                .meta(meta)
                .mediaUrls(mediaUrlsCsv)
                .build();

        return enrichDto(listingRepository.save(listing));
    }

    public ListingDto update(UUID id, String title, String description, BigDecimal price,
                              boolean negotiable, String city, String meta, String status) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        if (!listing.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("You don't own this listing");
        }

        if (title != null) listing.setTitle(title);
        if (description != null) listing.setDescription(description);
        if (price != null) listing.setPrice(price);
        listing.setNegotiable(negotiable);
        if (city != null) listing.setLocationCity(city);
        if (meta != null) listing.setMeta(meta);
        if (status != null) listing.setStatus(ListingStatus.valueOf(status));

        return enrichDto(listingRepository.save(listing));
    }

    public List<ListingDto> getMyListings() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return listingRepository.findBySellerId(seller.getId()).stream()
                .map(this::enrichDto).collect(Collectors.toList());
    }

    private ListingDto enrichDto(Listing listing) {
        ListingDto dto = ListingDto.fromEntity(listing);
        userRepository.findById(listing.getSellerId()).ifPresent(seller -> {
            dto.setSellerName(seller.getFullName());
            dto.setSellerAvatarUrl(seller.getAvatarUrl());
            dto.setSellerVerified(seller.isIdVerified());
        });
        Double avg = reviewRepository.averageRatingForUser(listing.getSellerId());
        dto.setAvgRating(avg != null ? avg : 0.0);
        dto.setReviewCount(reviewRepository.countByReviewedId(listing.getSellerId()));
        return dto;
    }
}
