package com.hustleup.config;

import com.hustleup.listing.Listing;
import com.hustleup.listing.ListingRepository;
import com.hustleup.listing.ListingStatus;
import com.hustleup.listing.ListingType;
import com.hustleup.social.Post;
import com.hustleup.social.PostRepository;
import com.hustleup.user.Role;
import com.hustleup.user.User;
import com.hustleup.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Configuration
public class DatabaseSeeder {

    @Bean
    public CommandLineRunner seedDatabase(UserRepository userRepo, ListingRepository listingRepo, PostRepository postRepo, PasswordEncoder encoder) {
        return args -> {
            if (!userRepo.existsByEmail("user1@test.com")) {
                System.out.println("Seeding database with default mock data...");

                // Create 10 Users
                List<User> users = new ArrayList<>();
                for (int i = 1; i <= 10; i++) {
                    User u = User.builder()
                        .email("user" + i + "@test.com")
                        .password(encoder.encode("password123"))
                        .fullName("Creator " + i)
                        .phone("555-010" + i)
                        .role(Role.SELLER)
                        .avatarUrl("https://api.dicebear.com/7.x/avataaars/svg?seed=Creator" + i)
                        .shopBannerUrl("http://localhost:8080/uploads/marketing.png")
                        .bio("Expert creator on HustleUp! Specializing in high end digital delivery.")
                        .city("Tech City " + i)
                        .emailVerified(true)
                        .build();
                    users.add(userRepo.save(u));
                }

                // Create 10 Listings
                String[] images = {
                    "http://localhost:8080/uploads/cyberpunk.png",
                    "http://localhost:8080/uploads/ux.png",
                    "http://localhost:8080/uploads/marketing.png"
                };

                for (int i = 1; i <= 10; i++) {
                    User seller = users.get(i % users.size());
                    Listing l = new Listing();
                    l.setSellerId(seller.getId());
                    l.setTitle("Premium Service Package " + i);
                    l.setDescription("An incredible description for this premium offering. Providing top-tier remote work and digital assets with guaranteed delivery.");
                    l.setPrice(BigDecimal.valueOf(100.0 * i));
                    l.setCurrency("PLN");
                    l.setListingType(ListingType.SKILL);
                    l.setStatus(ListingStatus.ACTIVE);
                    l.setLocationCity(seller.getCity());
                    l.setMediaUrls("[\"" + images[i % images.length] + "\"]");
                    listingRepo.save(l);
                }

                // Create 10 Posts
                for (int i = 1; i <= 10; i++) {
                    User author = users.get((i + 3) % users.size());
                    Post p = new Post();
                    p.setId(UUID.randomUUID().toString());
                    p.setAuthorId(author.getId().toString());
                    p.setAuthorName(author.getFullName());
                    p.setContent("Just finished an amazing project on HustleUp! Check out my profile for more details. #" + i);
                    p.setImageUrl(i % 2 == 0 ? images[i % images.length] : null); // Text-only posts mixed with text+image
                    p.setLikesCount(i * 15); // Add trending likes
                    p.setCommentsCount(i * 2);
                    postRepo.save(p);
                }

                System.out.println("Database seeded successfully!");
            }
        };
    }
}
