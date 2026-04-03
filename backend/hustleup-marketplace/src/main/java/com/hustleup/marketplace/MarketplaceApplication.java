package com.hustleup.marketplace;

import com.hustleup.listing.model.Listing;
import com.hustleup.listing.model.ListingStatus;
import com.hustleup.listing.model.ListingType;
import com.hustleup.listing.repository.ListingRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {
    "com.hustleup.listing.repository",
    "com.hustleup.booking.repository",
    "com.hustleup.review.repository",
    "com.hustleup.common.repository"
})
@EntityScan(basePackages = {
    "com.hustleup.listing.model",
    "com.hustleup.booking.model",
    "com.hustleup.review.model",
    "com.hustleup.common.model"
})
@ComponentScan(basePackages = {
    "com.hustleup.marketplace",
    "com.hustleup.listing",
    "com.hustleup.booking",
    "com.hustleup.review",
    "com.hustleup.common"
})
public class MarketplaceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MarketplaceApplication.class, args);
    }

    @Bean
    public CommandLineRunner seedListings(ListingRepository repo) {
        return args -> {
            if (repo.count() > 0) return; // already seeded

            // Verified seller IDs matching the social seeder users
            UUID sarah   = UUID.fromString("01a6a8cf-a547-4c3e-8b8d-54e8bc1798cc");
            UUID ibrahim = UUID.fromString("04d09278-1f95-4300-b4eb-cc4527b744ba");
            UUID chioma  = UUID.fromString("23d1c637-9528-493e-8659-f4d7247e635c");

            repo.saveAll(List.of(
                Listing.builder()
                    .sellerId(sarah)
                    .title("Premium Hair Braiding & Styling")
                    .description("Professional box braids, knotless braids, and loc styling. 10+ years experience. Home visits available.")
                    .listingType(ListingType.HAIR_BEAUTY)
                    .price(new BigDecimal("85.00"))
                    .currency("GBP")
                    .negotiable(true)
                    .locationCity("London")
                    .mediaUrls("https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(ibrahim)
                    .title("Full-Stack Web App Development")
                    .description("React + Spring Boot micro-services, custom APIs, dashboards, and e-commerce builds. MVP delivered in 5 days.")
                    .listingType(ListingType.SKILL)
                    .price(new BigDecimal("499.00"))
                    .currency("GBP")
                    .negotiable(true)
                    .locationCity("Remote")
                    .mediaUrls("https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(chioma)
                    .title("Afro-Fusion Catering — Events & Private Dining")
                    .description("Authentic West African dishes for your event. Jollof rice, egusi, suya platters. Minimum 20 guests.")
                    .listingType(ListingType.FOOD)
                    .price(new BigDecimal("25.00"))
                    .currency("GBP")
                    .negotiable(true)
                    .locationCity("Manchester")
                    .mediaUrls("https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(chioma)
                    .title("Handmade Ankara Fashion Collection")
                    .description("Bespoke Ankara dresses, co-ords and accessories. All sizes, custom orders welcome.")
                    .listingType(ListingType.FASHION)
                    .price(new BigDecimal("65.00"))
                    .currency("GBP")
                    .negotiable(false)
                    .locationCity("Birmingham")
                    .mediaUrls("https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(ibrahim)
                    .title("Logo & Brand Identity Design")
                    .description("Full brand kit: logo, colour palette, typography, and social media assets. 3 revisions included.")
                    .listingType(ListingType.SKILL)
                    .price(new BigDecimal("149.00"))
                    .currency("GBP")
                    .negotiable(false)
                    .locationCity("Remote")
                    .mediaUrls("https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(sarah)
                    .title("Photography — Portraits & Events")
                    .description("Professional portrait sessions, brand shoots, and event coverage. Studio or on-location.")
                    .listingType(ListingType.SKILL)
                    .price(new BigDecimal("120.00"))
                    .currency("GBP")
                    .negotiable(true)
                    .locationCity("London")
                    .mediaUrls("https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(chioma)
                    .title("Luxury Scented Candles — Hand Poured")
                    .description("Soy wax candles with African botanical scents. Gift boxes available. Ships UK-wide.")
                    .listingType(ListingType.GOODS)
                    .price(new BigDecimal("18.00"))
                    .currency("GBP")
                    .negotiable(false)
                    .locationCity("Birmingham")
                    .mediaUrls("https://images.unsplash.com/photo-1602607144291-ea57ab0dc5fc?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                Listing.builder()
                    .sellerId(sarah)
                    .title("Afrobeats & Amapiano Dance Workshop")
                    .description("Group and private sessions. Great for events, fitness, and fun. All levels welcome.")
                    .listingType(ListingType.EVENT)
                    .price(new BigDecimal("30.00"))
                    .currency("GBP")
                    .negotiable(false)
                    .locationCity("London")
                    .mediaUrls("https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build()
            ));

            System.out.println("MARKETPLACE_SEEDER: 8 listings created.");
        };
    }
}

