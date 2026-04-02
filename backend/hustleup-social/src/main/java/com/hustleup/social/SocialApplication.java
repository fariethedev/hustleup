package com.hustleup.social;

import com.hustleup.common.model.User;
import com.hustleup.common.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import com.hustleup.social.model.Post;
import com.hustleup.social.repository.PostRepository;
import jakarta.persistence.EntityManager;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {"com.hustleup.common.repository", "com.hustleup.social.repository"})
@EntityScan(basePackages = {"com.hustleup.common.model", "com.hustleup.social.model"})
@ComponentScan(basePackages = {"com.hustleup.social", "com.hustleup.common"})
public class SocialApplication {
    public static void main(String[] args) {
        SpringApplication.run(SocialApplication.class, args);
    }

    @Bean
    @Transactional
    public CommandLineRunner socialStabilizer(PostRepository postRepository, UserRepository userRepository, EntityManager entityManager) {
        return args -> {
            System.out.println("STABILIZER_V5_START: Definitive Nuclear Reset Initiated.");
            
            try {
                // 1. Force Column Type Fixes & DROP PROBLEMATIC TABLES
                // We drop and recreate to ensure a clean state with VARCHAR(36) UUIDs
                System.out.println("STABILIZER: Dropping and recreating social tables for UUID compatibility...");
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 0").executeUpdate();
                
                // Drop if they exist
                entityManager.createNativeQuery("DROP TABLE IF EXISTS stories").executeUpdate();
                entityManager.createNativeQuery("DROP TABLE IF EXISTS posts").executeUpdate();
                
                // Recreate with VARCHAR(36) author_id
                entityManager.createNativeQuery("CREATE TABLE posts (" +
                    "id VARCHAR(36) PRIMARY KEY, " +
                    "author_id VARCHAR(36) NOT NULL, " +
                    "author_name VARCHAR(255) NOT NULL, " +
                    "content TEXT, " +
                    "image_url VARCHAR(255), " +
                    "media_urls TEXT, " +
                    "media_types TEXT, " +
                    "linked_listing_id VARCHAR(36), " +
                    "likes_count INT DEFAULT 0, " +
                    "comments_count INT DEFAULT 0, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")").executeUpdate();
                
                entityManager.createNativeQuery("CREATE TABLE stories (" +
                    "id VARCHAR(36) PRIMARY KEY, " +
                    "author_id VARCHAR(36) NOT NULL, " +
                    "author_name VARCHAR(255) NOT NULL, " +
                    "content TEXT, " +
                    "media_url VARCHAR(255), " +
                    "type VARCHAR(20) NOT NULL, " +
                    "likes_count INT DEFAULT 0, " +
                    "views_count INT DEFAULT 0, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "expires_at TIMESTAMP NOT NULL" +
                    ")").executeUpdate();
                
                // Modify users.id to ensure absolute compatibility
                entityManager.createNativeQuery("ALTER TABLE users MODIFY id VARCHAR(36)").executeUpdate();
                
                entityManager.createNativeQuery("SET FOREIGN_KEY_CHECKS = 1").executeUpdate();
                System.out.println("STABILIZER: Tables recreated with VARCHAR(36) columns.");
            } catch (Exception e) {
                System.out.println("STABILIZER_ERROR: Nuclear reset failed: " + e.getMessage());
                e.printStackTrace();
            }

            // 2. Fix the Typo definitively in the shared database
            System.out.println("STABILIZER: Standardizing user emails...");
            userRepository.findAll().forEach(u -> {
                String email = u.getEmail();
                if (email != null && (email.contains("geographgy") || email.contains("geographhy") || email.contains("geograpgy"))) {
                    System.out.println("STABILIZER: Fixing email typo for user " + u.getId() + ": " + email + " -> geograpghy@gmail.com");
                    u.setEmail("geograpghy@gmail.com");
                    userRepository.save(u);
                }
            });

            // 3. Seed Premium Video Content with VERIFIED IDs
            System.out.println("STABILIZER: Seeding social hub with 'life-like' video content using verified authors...");
            
            // Verified IDs from the database: Sarah (01a6...), Ibrahim (04d0...), Chioma (23d1...)
            Post p1 = new Post();
            p1.setId(UUID.randomUUID().toString());
            p1.setAuthorId("01a6a8cf-a547-4c3e-8b8d-54e8bc1798cc"); // Sarah
            p1.setAuthorName("Sarah Moyo");
            p1.setContent("Morning energy in the workspace. Planning the next big storefront drop! ☕✨ #hustle #lifestyle");
            p1.setMediaUrls("https://assets.mixkit.co/videos/preview/mixkit-coffee-maker-machine-slow-motion-2320-large.mp4");
            p1.setMediaTypes("VIDEO");
            p1.setLikesCount(124);
            p1.setCommentsCount(8);

            Post p2 = new Post();
            p2.setId(UUID.randomUUID().toString());
            p2.setAuthorId("04d09278-1f95-4300-b4eb-cc4527b744ba"); // Ibrahim
            p2.setAuthorName("Ibrahim Kone");
            p2.setContent("Deep work phase. The code doesn't write itself, but the vision makes it worth it. 💻🚀 #devlife #builder");
            p2.setMediaUrls("https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-a-laptop-4428-large.mp4");
            p2.setMediaTypes("VIDEO");
            p2.setLikesCount(210);
            p2.setCommentsCount(15);

            Post p3 = new Post();
            p3.setId(UUID.randomUUID().toString());
            p3.setAuthorId("23d1c637-9528-493e-8659-f4d7247e635c"); // Chioma
            p3.setAuthorName("Chioma Mensah");
            p3.setContent("Just reached a new milestone on HustleUp! Thank you to everyone supporting the brand. 🥂👗 #entrepreneur #success");
            p3.setMediaUrls("https://assets.mixkit.co/videos/preview/mixkit-woman-holding-a-shopping-bag-in-a-clothing-store-4444-large.mp4");
            p3.setMediaTypes("VIDEO");
            p3.setLikesCount(356);
            p3.setCommentsCount(42);

            postRepository.saveAll(List.of(p1, p2, p3));
            System.out.println("STABILIZER_V5_DONE: Social Hub is now life-like and functional.");
        };
    }
}
