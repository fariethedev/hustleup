/**
 * Entry point for the HustleUp Marketplace microservice.
 *
 * <p>This class bootstraps the entire Spring Boot application. It is responsible for:
 * <ul>
 *   <li>Starting the embedded web server (Tomcat by default)</li>
 *   <li>Wiring together all Spring-managed beans across the listing, booking, review, and
 *       common packages via {@code @ComponentScan}</li>
 *   <li>Registering all JPA repositories so Spring Data can generate SQL-backed
 *       implementations at runtime via {@code @EnableJpaRepositories}</li>
 *   <li>Scanning JPA entity classes so Hibernate can build the database schema via
 *       {@code @EntityScan}</li>
 *   <li>Seeding the database with realistic demo listings on first boot via a
 *       {@link CommandLineRunner} bean</li>
 * </ul>
 *
 * <p>Why are {@code @EnableJpaRepositories}, {@code @EntityScan}, and {@code @ComponentScan}
 * all declared explicitly here? Because the entities and repositories live in sub-packages
 * that belong to different logical modules (listing, booking, review, common). Spring Boot's
 * default auto-configuration only scans the package of the main class and its children. By
 * listing every sub-package explicitly we ensure nothing is missed.
 */
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

// @SpringBootApplication is a convenience annotation that combines:
//   @Configuration   — marks this class as a source of bean definitions
//   @EnableAutoConfiguration — tells Spring Boot to guess and configure beans automatically
//   @ComponentScan   — scans for @Component/@Service/@Controller etc. in the current package
// We override the default @ComponentScan behaviour below with our own explicit list.
@SpringBootApplication
// Tell Spring Data JPA where to find repository interfaces. Spring generates
// concrete implementations backed by Hibernate at startup. Without this, only
// repositories in com.hustleup.marketplace would be discovered.
@EnableJpaRepositories(basePackages = {
    "com.hustleup.listing.repository",
    "com.hustleup.booking.repository",
    "com.hustleup.review.repository",
    "com.hustleup.common.repository"
})
// Tell Hibernate which packages contain @Entity classes so it can map them to
// database tables and build/validate the schema on startup.
@EntityScan(basePackages = {
    "com.hustleup.listing.model",
    "com.hustleup.booking.model",
    "com.hustleup.review.model",
    "com.hustleup.common.model"
})
// Explicit component scan so that @Service, @RestController, @Repository beans
// in every module are picked up and registered in the Spring application context.
@ComponentScan(basePackages = {
    "com.hustleup.marketplace",
    "com.hustleup.listing",
    "com.hustleup.booking",
    "com.hustleup.review",
    "com.hustleup.common"
})
public class MarketplaceApplication {

    /**
     * The Java application entry point. Delegates entirely to Spring Boot's launcher
     * which creates the application context, starts the embedded server, and runs
     * all {@link CommandLineRunner} beans after startup.
     *
     * @param args command-line arguments forwarded to the Spring environment
     *             (can be used to set properties like {@code --server.port=9090})
     */
    public static void main(String[] args) {
        SpringApplication.run(MarketplaceApplication.class, args);
    }

    /**
     * Database seeder that inserts a set of realistic demo listings on first boot.
     *
     * <p>A {@link CommandLineRunner} is a Spring callback interface whose {@code run()}
     * method is executed once, after the application context is fully initialised but
     * before the application starts accepting HTTP traffic. It is perfect for one-time
     * setup tasks like seeding reference data.
     *
     * <p>The guard {@code if (repo.count() > 0) return;} makes this idempotent: if any
     * listings already exist (e.g. from a previous run or from a production database),
     * the seeder does nothing and the existing data is preserved.
     *
     * @param repo Spring Data repository injected automatically; used to persist listings
     * @return the {@link CommandLineRunner} lambda that Spring will invoke after startup
     */
    @Bean // Declares this method's return value as a Spring-managed bean
    public CommandLineRunner seedListings(ListingRepository repo) {
        return args -> {
            // Guard: skip seeding entirely if the table already has data.
            // This prevents duplicates when the service is restarted in production.
            if (repo.count() > 0) return; // already seeded

            // Verified seller IDs matching the social seeder users
            // These UUIDs correspond to real user rows created by the social-service seeder,
            // so listing.sellerId will resolve to an actual user profile.
            UUID sarah   = UUID.fromString("01a6a8cf-a547-4c3e-8b8d-54e8bc1798cc");
            UUID ibrahim = UUID.fromString("04d09278-1f95-4300-b4eb-cc4527b744ba");
            UUID chioma  = UUID.fromString("23d1c637-9528-493e-8659-f4d7247e635c");

            // repo.saveAll() is more efficient than calling repo.save() in a loop because it
            // issues a single batch INSERT rather than N separate INSERT statements.
            repo.saveAll(List.of(

                // --- Sarah's listings ---

                // Hair braiding service — uses HAIR_BEAUTY type, priced per session
                Listing.builder()
                    .sellerId(sarah)
                    .title("Premium Hair Braiding & Styling")
                    .description("Professional box braids, knotless braids, and loc styling. 10+ years experience. Home visits available.")
                    .listingType(ListingType.HAIR_BEAUTY)
                    .price(new BigDecimal("85.00"))
                    .currency("GBP")
                    .negotiable(true) // price can be discussed with the seller
                    .locationCity("London")
                    .mediaUrls("https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80")
                    .status(ListingStatus.ACTIVE) // immediately visible in browse/search
                    .build(),

                // --- Ibrahim's listings ---

                // Full-stack development gig — SKILL type, high-value remote service
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

                // --- Chioma's listings ---

                // Catering service — FOOD type, priced per head
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

                // Fashion/clothing listing — FASHION type, fixed price
                Listing.builder()
                    .sellerId(chioma)
                    .title("Handmade Ankara Fashion Collection")
                    .description("Bespoke Ankara dresses, co-ords and accessories. All sizes, custom orders welcome.")
                    .listingType(ListingType.FASHION)
                    .price(new BigDecimal("65.00"))
                    .currency("GBP")
                    .negotiable(false) // firm price, no haggling
                    .locationCity("Birmingham")
                    .mediaUrls("https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80")
                    .status(ListingStatus.ACTIVE)
                    .build(),

                // Brand design service — Ibrahim's second listing
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

                // Photography service — Sarah's second listing
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

                // Physical goods listing — Chioma selling handmade candles
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

                // Event/experience listing — a dance workshop with ticketed pricing
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

            // Log confirmation so it shows up clearly in the startup log
            System.out.println("MARKETPLACE_SEEDER: 8 listings created.");
        };
    }
}

