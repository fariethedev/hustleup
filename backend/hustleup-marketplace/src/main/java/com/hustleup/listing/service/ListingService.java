/**
 * Business logic layer for listing management on the HustleUp marketplace.
 */
package com.hustleup.listing.service;

import com.hustleup.listing.dto.ListingDto;
import com.hustleup.listing.model.Listing;
import com.hustleup.listing.model.ListingStatus;
import com.hustleup.listing.model.ListingType;
import com.hustleup.listing.repository.ListingRepository;
import com.hustleup.review.repository.ReviewRepository;
import com.hustleup.common.storage.FileStorageService;
import com.hustleup.common.model.User;
import com.hustleup.common.model.Notification;
import com.hustleup.common.repository.UserRepository;
import com.hustleup.common.repository.NotificationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ListingService {

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final FileStorageService fileStorageService;
    private final NotificationRepository notificationRepository;
    private final JdbcTemplate jdbcTemplate;

    public ListingService(ListingRepository listingRepository, UserRepository userRepository,
                          ReviewRepository reviewRepository, FileStorageService fileStorageService,
                          NotificationRepository notificationRepository, JdbcTemplate jdbcTemplate) {
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
        this.reviewRepository = reviewRepository;
        this.fileStorageService = fileStorageService;
        this.notificationRepository = notificationRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ListingDto> getAll(String q, ListingType type, String city, BigDecimal maxPrice, Boolean negotiable) {
        if (q != null && q.trim().isEmpty()) {
            q = null;
        }
        List<Listing> listings = listingRepository.findWithFilters(q, type, city, maxPrice, negotiable);
        return listings.stream().map(this::enrichDto).collect(Collectors.toList());
    }

    public ListingDto getById(UUID id) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));
        return enrichDto(listing);
    }

    public List<ListingDto> getByUser(UUID sellerId) {
        return listingRepository.findBySellerIdAndStatusNot(sellerId, ListingStatus.DELETED)
                .stream()
                .map(this::enrichDto)
                .collect(Collectors.toList());
    }

    public ListingDto create(String title, String description, String listingType, BigDecimal price,
                              String currency, boolean negotiable, String city, boolean agentFee,
                              String meta, List<MultipartFile> images) {
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
                .agentFee(agentFee)
                .meta(meta)
                .mediaUrls(mediaUrlsCsv)
                .build();

        Listing saved = listingRepository.save(listing);
        notifyFollowersOfNewListing(seller, saved);
        return enrichDto(saved);
    }

    private void notifyFollowersOfNewListing(User seller, Listing saved) {
        try {
            String sellerId = seller.getId().toString();
            List<String> followerIds = jdbcTemplate.queryForList(
                    "SELECT follower_id FROM follows WHERE following_id = ?", String.class, sellerId);
            if (!followerIds.isEmpty()) {
                String sellerName = seller.getFullName() != null && !seller.getFullName().isBlank()
                        ? seller.getFullName() : seller.getEmail().split("@")[0];
                List<Notification> notifs = followerIds.stream().map(fid -> {
                    try {
                        return Notification.builder()
                                .userId(UUID.fromString(fid))
                                .title(sellerName + " listed something new")
                                .message(saved.getTitle())
                                .notificationType("LISTING")
                                .referenceId(saved.getId())
                                .build();
                    } catch (Exception e) { return null; }
                }).filter(Objects::nonNull).collect(Collectors.toList());
                notificationRepository.saveAll(notifs);
            }
        } catch (Exception ignored) {
        }
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

    public void delete(UUID id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User seller = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Listing not found"));

        if (!listing.getSellerId().equals(seller.getId())) {
            throw new RuntimeException("You don't own this listing");
        }

        listingRepository.deleteById(id);
    }

    private ListingDto enrichDto(Listing listing) {
        ListingDto dto = ListingDto.fromEntity(listing, fileStorageService::refreshUrl);
        try {
            userRepository.findById(listing.getSellerId()).ifPresent(seller -> {
                dto.setSellerName(seller.getFullName());
                String avatarUrl = seller.getAvatarUrl();
                dto.setSellerAvatarUrl(avatarUrl != null ? fileStorageService.refreshUrl(avatarUrl) : null);
                dto.setSellerVerified(seller.isIdVerified());
            });
            Double avg = reviewRepository.averageRatingForUser(listing.getSellerId());
            dto.setAvgRating(avg != null ? avg : 0.0);
            dto.setReviewCount(reviewRepository.countByReviewedId(listing.getSellerId()));
        } catch (Exception e) {
            dto.setAvgRating(0.0);
            dto.setReviewCount(0);
        }
        return dto;
    }

    public List<ListingDto> getRecommended() {
        String email;
        try {
            email = SecurityContextHolder.getContext().getAuthentication().getName();
        } catch (Exception e) {
            return getAll(null, null, null, null, null);
        }

        User viewer = userRepository.findByEmail(email).orElse(null);
        if (viewer == null) return getAll(null, null, null, null, null);

        String viewerId = viewer.getId().toString();
        String viewerCity = viewer.getCity() != null ? viewer.getCity().trim().toLowerCase() : "";

        Set<String> following;
        try {
            following = new HashSet<>(jdbcTemplate.queryForList(
                    "SELECT following_id FROM follows WHERE follower_id = ?",
                    String.class, viewerId));
        } catch (Exception e) {
            following = Collections.emptySet();
        }

        final Set<String> followingIds = following;
        final String city = viewerCity;

        List<Listing> active = listingRepository.findWithFilters(null, null, null, null, null);
        long nowMs = System.currentTimeMillis();

        record Scored(Listing listing, double score) {}

        List<ListingDto> result = active.stream()
                .map(l -> {
                    double rec  = listingRecency(l, nowMs);
                    double qual = listingQuality(l);
                    double fol  = followingIds.contains(l.getSellerId().toString()) ? 60.0 : 0.0;
                    double loc  = (!city.isEmpty() && city.equals(
                            l.getLocationCity() != null ? l.getLocationCity().trim().toLowerCase() : ""))
                            ? 25.0 : 0.0;
                    return new Scored(l, rec + qual + fol + loc);
                })
                .sorted(Comparator.comparingDouble(Scored::score).reversed())
                .map(s -> enrichDto(s.listing()))
                .collect(Collectors.toList());

        return result;
    }

    private double listingRecency(Listing l, long nowMs) {
        if (l.getCreatedAt() == null) return 0.0;
        double ageDays = (nowMs - l.getCreatedAt().toInstant(ZoneOffset.UTC).toEpochMilli()) / 86_400_000.0;
        return 80.0 * Math.exp(-0.09 * ageDays);
    }

    private double listingQuality(Listing l) {
        try {
            Double avg = reviewRepository.averageRatingForUser(l.getSellerId());
            long cnt   = reviewRepository.countByReviewedId(l.getSellerId());
            if (avg == null || cnt == 0) return 0.0;
            return Math.min(avg * cnt * 1.5, 45.0);
        } catch (Exception e) {
            return 0.0;
        }
    }
}
