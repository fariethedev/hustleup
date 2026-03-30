package com.hustleup.config;

import com.hustleup.auth.RefreshTokenRepository;
import com.hustleup.booking.Booking;
import com.hustleup.booking.BookingRepository;
import com.hustleup.booking.BookingStatus;
import com.hustleup.dating.DatingProfile;
import com.hustleup.dating.DatingProfileRepository;
import com.hustleup.listing.Listing;
import com.hustleup.listing.ListingRepository;
import com.hustleup.listing.ListingStatus;
import com.hustleup.listing.ListingType;
import com.hustleup.messaging.ChatMessage;
import com.hustleup.messaging.ChatMessageRepository;
import com.hustleup.messaging.DirectMessage;
import com.hustleup.messaging.DirectMessageRepository;
import com.hustleup.notification.Notification;
import com.hustleup.notification.NotificationRepository;
import com.hustleup.review.Review;
import com.hustleup.review.ReviewRepository;
import com.hustleup.social.Comment;
import com.hustleup.social.CommentRepository;
import com.hustleup.social.Post;
import com.hustleup.social.PostRepository;
import com.hustleup.social.Story;
import com.hustleup.social.StoryRepository;
import com.hustleup.subscription.Subscription;
import com.hustleup.subscription.SubscriptionRepository;
import com.hustleup.user.Follow;
import com.hustleup.user.FollowRepository;
import com.hustleup.user.Role;
import com.hustleup.user.User;
import com.hustleup.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Configuration
public class DatabaseSeeder {

    @Bean
    public CommandLineRunner seedDatabase(
            UserRepository userRepository,
            ListingRepository listingRepository,
            PostRepository postRepository,
            CommentRepository commentRepository,
            StoryRepository storyRepository,
            FollowRepository followRepository,
            ReviewRepository reviewRepository,
            DatingProfileRepository datingProfileRepository,
            BookingRepository bookingRepository,
            ChatMessageRepository chatMessageRepository,
            DirectMessageRepository directMessageRepository,
            NotificationRepository notificationRepository,
            SubscriptionRepository subscriptionRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbcTemplate) {
        return args -> {
            if (userRepository.existsByEmail("marcus.adeyemi@hustleup.com")) {
                return;
            }

            clearDatabase(jdbcTemplate);

            User marcus = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "marcus.adeyemi@hustleup.com", "Marcus Adeyemi", Role.SELLER, "Warszawa", "48721010001",
                    "Full-stack builder delivering fast product launches, UX cleanups, and custom automations for founders.",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&q=80",
                    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=80",
                    true, true, true, 18, 2));
            User linda = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "linda.okafor@hustleup.com", "Linda Okafor", Role.SELLER, "Krakow", "48721010002",
                    "Brand designer and content strategist building polished visuals for shops, creators, and small teams.",
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80",
                    "https://images.unsplash.com/photo-1517502884422-41eaead166d4?w=1600&q=80",
                    true, true, true, 26, 4));
            User sarah = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "sarah.moyo@hustleup.com", "Sarah Moyo", Role.BUYER, "Wroclaw", "48721010003",
                    "Frequent buyer looking for reliable beauty, food, and event vendors with fast response times.",
                    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200&q=80",
                    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80",
                    true, true, false, 6, 1));
            User daniel = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "daniel.dube@hustleup.com", "Daniel Dube", Role.SELLER, "Gdansk", "48721010004",
                    "Event host and AV coordinator booking live sets, panels, and pop-up experiences across Poland.",
                    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80",
                    "https://images.unsplash.com/photo-1497366412874-3415097a27e7?w=1600&q=80",
                    true, true, true, 14, 9));
            User ibrahim = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "ibrahim.kone@hustleup.com", "Ibrahim Kone", Role.SELLER, "Poznan", "48721010005",
                    "Food entrepreneur running premium catering drops, meal prep programs, and private dinner service.",
                    "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=1200&q=80",
                    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&q=80",
                    true, true, true, 21, 6));
            User aisha = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "aisha.bello@hustleup.com", "Aisha Bello", Role.BUYER, "Lodz", "48721010006",
                    "Community-first buyer who books stylists, caters events, and supports local fashion drops.",
                    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80",
                    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&q=80",
                    true, true, false, 4, 0));
            User grace = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "grace.ncube@hustleup.com", "Grace Ncube", Role.SELLER, "Warszawa", "48721010007",
                    "Hair and beauty specialist offering bridal glam, braiding sessions, and premium house calls.",
                    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1200&q=80",
                    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1600&q=80",
                    true, true, true, 31, 3));
            User tunde = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "tunde.alabi@hustleup.com", "Tunde Alabi", Role.SELLER, "Katowice", "48721010008",
                    "Streetwear founder shipping curated pieces, accessories, and capsule collections every month.",
                    "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=1200&q=80",
                    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1600&q=80",
                    true, true, true, 12, 11));
            User chioma = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "chioma.mensah@hustleup.com", "Chioma Mensah", Role.BUYER, "Gdynia", "48721010009",
                    "Remote operator buying logistics help, digital services, and gifts for her team.",
                    "https://images.unsplash.com/photo-1546961329-78bef0414d7c?w=1200&q=80",
                    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80",
                    true, false, false, 3, 8));
            User zanele = saveUser(userRepository, passwordEncoder, new UserSeed(
                    "zanele.sibanda@hustleup.com", "Zanele Sibanda", Role.SELLER, "Szczecin", "48721010010",
                    "Creative producer mixing product styling, campaign shoots, and launch support for new brands.",
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&q=80",
                    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
                    true, true, true, 28, 5));

            Listing marcusPlatform = saveListing(listingRepository, marcus, "Marketplace MVP in 7 days",
                    "Ship a clean web MVP with auth, dashboards, listings, and polished responsive screens in one sprint.",
                    ListingType.SKILL, "3500", "PLN", true, "Warszawa",
                    media("https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1600&q=80",
                            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1600&q=80"),
                    "{\"delivery\":\"7 days\",\"stack\":\"React, Spring Boot\"}", ListingStatus.ACTIVE);
            Listing marcusAutomation = saveListing(listingRepository, marcus, "CRM and workflow automation setup",
                    "Automate lead capture, notifications, and admin workflows for your service business with clean handoff docs.",
                    ListingType.SKILL, "1800", "PLN", true, "Warszawa",
                    media("https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1600&q=80",
                            "https://images.unsplash.com/photo-1516321165247-4aa89a48be28?w=1600&q=80"),
                    "{\"delivery\":\"3 days\",\"includes\":\"automation audit\"}", ListingStatus.ACTIVE);
            Listing lindaBranding = saveListing(listingRepository, linda, "Luxury brand identity kit",
                    "Naming support, logo system, social launch visuals, and conversion-ready product page assets.",
                    ListingType.SKILL, "2400", "PLN", false, "Krakow",
                    media("https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1600&q=80",
                            "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1600&q=80"),
                    "{\"delivery\":\"5 days\",\"revisions\":\"2\"}", ListingStatus.ACTIVE);
            Listing danielStage = saveListing(listingRepository, daniel, "Pop-up event production package",
                    "Lighting, schedule coordination, host support, and audience flow design for high-energy events.",
                    ListingType.EVENT, "4200", "PLN", true, "Gdansk",
                    media("https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=80",
                            "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1600&q=80"),
                    "{\"crew\":\"4 people\",\"duration\":\"1 day\"}", ListingStatus.ACTIVE);
            Listing danielDj = saveListing(listingRepository, daniel, "Live DJ and MC booking",
                    "Afrobeats, amapiano, dancehall, and crowd-control hosting for club nights, parties, and launch events.",
                    ListingType.EVENT, "2600", "PLN", true, "Gdansk",
                    media("https://images.unsplash.com/photo-1571266028243-8e0f76c75d9d?w=1600&q=80",
                            "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&q=80"),
                    "{\"setLength\":\"4 hours\",\"genres\":\"Afrobeats, Amapiano\"}", ListingStatus.ACTIVE);
            Listing ibrahimCatering = saveListing(listingRepository, ibrahim, "Private dinner catering for 20",
                    "Curated West African fusion menu with service staff, setup, and premium presentation for intimate events.",
                    ListingType.FOOD, "3200", "PLN", false, "Poznan",
                    media("https://images.unsplash.com/photo-1555244162-803834f70033?w=1600&q=80",
                            "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=1600&q=80"),
                    "{\"guests\":\"20\",\"menu\":\"custom\"}", ListingStatus.ACTIVE);
            Listing ibrahimPrep = saveListing(listingRepository, ibrahim, "Weekly executive meal prep",
                    "Healthy, high-protein meal prep delivered twice a week with macro breakdowns and rotating menus.",
                    ListingType.FOOD, "650", "PLN", false, "Poznan",
                    media("https://images.unsplash.com/photo-1547592180-85f173990554?w=1600&q=80",
                            "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1600&q=80"),
                    "{\"weeks\":\"1\",\"delivery\":\"twice\"}", ListingStatus.ACTIVE);
            Listing graceBridal = saveListing(listingRepository, grace, "Bridal glam and braids package",
                    "Full bridal preparation including hair styling, makeup coordination, and touch-up support on site.",
                    ListingType.HAIR_BEAUTY, "2100", "PLN", true, "Warszawa",
                    media("https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1600&q=80",
                            "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1600&q=80"),
                    "{\"session\":\"bridal\",\"travel\":\"included\"}", ListingStatus.ACTIVE);
            Listing graceBraids = saveListing(listingRepository, grace, "Signature knotless braids",
                    "Protective styling session with premium hair, scalp prep, and aftercare guidance.",
                    ListingType.HAIR_BEAUTY, "480", "PLN", false, "Warszawa",
                    media("https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80",
                            "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1600&q=80"),
                    "{\"duration\":\"4 hours\",\"aftercare\":\"included\"}", ListingStatus.ACTIVE);
            Listing tundeStreetwear = saveListing(listingRepository, tunde, "Limited capsule streetwear drop",
                    "Premium heavyweight tees, cargos, and layered basics from the latest HustleLab capsule release.",
                    ListingType.FASHION, "390", "PLN", false, "Katowice",
                    media("https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=1600&q=80",
                            "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1600&q=80"),
                    "{\"drop\":\"Spring capsule\",\"sizes\":\"S-XL\"}", ListingStatus.ACTIVE);
            Listing tundeStyling = saveListing(listingRepository, tunde, "Creative direction and wardrobe styling",
                    "Editorial and campaign styling for artists, founders, and e-commerce shoots.",
                    ListingType.FASHION, "1700", "PLN", true, "Katowice",
                    media("https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1600&q=80",
                            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1600&q=80"),
                    "{\"shoots\":\"editorial\",\"looks\":\"5\"}", ListingStatus.ACTIVE);
            Listing zaneleShoot = saveListing(listingRepository, zanele, "Product campaign shoot",
                    "Styled product photography with art direction, prop sourcing, and campaign-ready social crops.",
                    ListingType.GOODS, "2800", "PLN", true, "Szczecin",
                    media("https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1600&q=80",
                            "https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=1600&q=80"),
                    "{\"assets\":\"18 edited photos\",\"ratio\":\"1:1 and 4:5\"}", ListingStatus.ACTIVE);
            Listing zaneleLaunch = saveListing(listingRepository, zanele, "Launch box packaging kit",
                    "Custom product boxes, inserts, stickers, and premium finishing for boutique brand launches.",
                    ListingType.GOODS, "1200", "PLN", false, "Szczecin",
                    media("https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1600&q=80",
                            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1600&q=80"),
                    "{\"minimumOrder\":\"50 units\",\"turnaround\":\"6 days\"}", ListingStatus.ACTIVE);

            saveFollow(followRepository, sarah, marcus);
            saveFollow(followRepository, sarah, grace);
            saveFollow(followRepository, aisha, linda);
            saveFollow(followRepository, aisha, ibrahim);
            saveFollow(followRepository, chioma, marcus);
            saveFollow(followRepository, chioma, zanele);
            saveFollow(followRepository, linda, marcus);
            saveFollow(followRepository, grace, linda);
            saveFollow(followRepository, zanele, tunde);
            saveFollow(followRepository, tunde, marcus);

            saveSubscription(subscriptionRepository, marcus, "VERIFIED", "ACTIVE", "89.00", "PLN", 20);
            saveSubscription(subscriptionRepository, linda, "PRO", "ACTIVE", "69.00", "PLN", 30);
            saveSubscription(subscriptionRepository, daniel, "VERIFIED", "ACTIVE", "89.00", "PLN", 18);
            saveSubscription(subscriptionRepository, ibrahim, "FREE", "ACTIVE", "20.00", "PLN", null);
            saveSubscription(subscriptionRepository, grace, "PRO", "ACTIVE", "69.00", "PLN", 14);
            saveSubscription(subscriptionRepository, tunde, "FREE", "ACTIVE", "20.00", "PLN", null);
            saveSubscription(subscriptionRepository, zanele, "VERIFIED", "ACTIVE", "89.00", "PLN", 26);

            saveDatingProfile(datingProfileRepository, marcus, 31, "MALE", "FEMALE", "Networking",
                    "Founder energy, late-night shipping sessions, and weekend coffee meets after launch week.",
                    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1600&q=80");
            saveDatingProfile(datingProfileRepository, linda, 29, "FEMALE", "MALE", "Dating",
                    "Designer who loves ambitious people, gallery nights, and turning wild ideas into polished brands.",
                    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1600&q=80");
            saveDatingProfile(datingProfileRepository, sarah, 28, "FEMALE", "ANY", "Friends",
                    "Always scouting great vendors and even better conversation over brunch or a city walk.",
                    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1600&q=80");
            saveDatingProfile(datingProfileRepository, daniel, 33, "MALE", "ANY", "Networking",
                    "Music curator, event host, and believer in building loud communities around good work.",
                    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1600&q=80");
            saveDatingProfile(datingProfileRepository, grace, 30, "FEMALE", "MALE", "Dating",
                    "Beauty specialist, soft-life strategist, and fan of people who actually show up with intent.",
                    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1600&q=80");
            saveDatingProfile(datingProfileRepository, tunde, 29, "MALE", "FEMALE", "Dating",
                    "Streetwear founder with a weakness for strong style, sharp playlists, and spontaneous city nights.",
                    "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=1600&q=80");
            saveDatingProfile(datingProfileRepository, zanele, 27, "FEMALE", "ANY", "Networking",
                    "Creative producer who likes big launch ideas, cleaner work, and real chemistry.",
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1600&q=80");

            Post post1 = savePost(postRepository, marcus, "Wrapped a marketplace sprint for a Warsaw founder this week. Payments, dashboards, and messaging all landed before launch day.", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1600&q=80", marcusPlatform, 34, 2, 9);
            Post post2 = savePost(postRepository, linda, "Rebranding a beauty studio from scratch. Moodboards are done and the product packaging direction finally clicked.", "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1600&q=80", lindaBranding, 29, 2, 7);
            Post post3 = savePost(postRepository, daniel, "Gdansk rooftop event tonight. Lineup locked, sound check passed, and the host script is finally tight.", "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1600&q=80", danielStage, 42, 1, 5);
            Post post4 = savePost(postRepository, ibrahim, "Meal prep slots for next week are almost full. Added a new spicy grilled chicken bowl and a fresh vegan combo.", "https://images.unsplash.com/photo-1547592180-85f173990554?w=1600&q=80", ibrahimPrep, 21, 1, 3);
            Post post5 = savePost(postRepository, grace, "Bridal calendar opened for summer. I only take a few full-service dates each month so the prep stays premium.", "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1600&q=80", graceBridal, 37, 2, 1);
            Post post6 = savePost(postRepository, tunde, "New capsule is live. Heavyweight pieces, clean cuts, and enough texture to carry a whole shoot.", "https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=1600&q=80", tundeStreetwear, 26, 1, 2);

            saveComment(commentRepository, post1, sarah, "This is exactly the kind of dev support I need for my next launch.");
            saveComment(commentRepository, post1, chioma, "Love seeing fast builds with actual polish.");
            saveComment(commentRepository, post2, aisha, "The packaging direction looks premium already.");
            saveComment(commentRepository, post2, grace, "You always make brands feel expensive in the best way.");
            saveComment(commentRepository, post3, marcus, "That rooftop lineup is going to hit.");
            saveComment(commentRepository, post4, sarah, "Need that vegan combo in my life.");
            saveComment(commentRepository, post5, aisha, "Saving this for my cousin's wedding.");
            saveComment(commentRepository, post5, linda, "The detail work on your bridal prep is top-tier.");
            saveComment(commentRepository, post6, zanele, "That capsule should be on every campaign set this month.");

            saveStory(storyRepository, marcus, Story.StoryType.TEXT, "Shipping a fresh dashboard build tonight.", null, 22);
            saveStory(storyRepository, linda, Story.StoryType.IMAGE, null, "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1600&q=80", 21);
            saveStory(storyRepository, grace, Story.StoryType.TEXT, "Last bridal slot this weekend just opened.", null, 20);
            saveStory(storyRepository, ibrahim, Story.StoryType.IMAGE, null, "https://images.unsplash.com/photo-1547592180-85f173990554?w=1600&q=80", 19);
            saveStory(storyRepository, tunde, Story.StoryType.TEXT, "Capsule drop almost sold out.", null, 18);

            Booking booking1 = saveBooking(bookingRepository, sarah, marcus, marcusPlatform, BookingStatus.INQUIRED, "3400", null, null, 4);
            Booking booking2 = saveBooking(bookingRepository, aisha, grace, graceBridal, BookingStatus.NEGOTIATING, "1900", "2050", null, 6);
            Booking booking3 = saveBooking(bookingRepository, chioma, ibrahim, ibrahimPrep, BookingStatus.BOOKED, "650", null, "650", 3);
            Booking booking4 = saveBooking(bookingRepository, sarah, daniel, danielStage, BookingStatus.COMPLETED, "4200", null, "4200", -10);
            Booking booking5 = saveBooking(bookingRepository, aisha, linda, lindaBranding, BookingStatus.COMPLETED, "2400", null, "2400", -18);
            Booking booking6 = saveBooking(bookingRepository, chioma, zanele, zaneleShoot, BookingStatus.CANCELLED, "2600", null, null, -4);

            saveChatMessage(chatMessageRepository, booking4, sarah, "Thanks again for handling the event flow. The guests loved the pacing.");
            saveChatMessage(chatMessageRepository, booking4, daniel, "Appreciate it. The team was solid and your brief made execution easy.");
            saveChatMessage(chatMessageRepository, booking4, sarah, "I'll be booking another production night next quarter.");
            saveChatMessage(chatMessageRepository, booking5, aisha, "I shared the first draft deck with my team and everyone loved it.");
            saveChatMessage(chatMessageRepository, booking5, linda, "Perfect. I can prep the final export package tonight.");
            saveChatMessage(chatMessageRepository, booking3, chioma, "Can you start deliveries from Monday morning?");
            saveChatMessage(chatMessageRepository, booking3, ibrahim, "Yes, I'll have the first batch out before 9 AM.");

            saveDirectMessage(directMessageRepository, marcus, linda, "That new homepage section looks stronger now.");
            saveDirectMessage(directMessageRepository, linda, marcus, "Good. The user cards finally feel alive.");
            saveDirectMessage(directMessageRepository, sarah, grace, "Are you still taking house-call glam sessions this month?");
            saveDirectMessage(directMessageRepository, grace, sarah, "Yes, two weekend slots are still open.");
            saveDirectMessage(directMessageRepository, chioma, ibrahim, "Can I switch one meal prep delivery to Tuesday evening?");
            saveDirectMessage(directMessageRepository, ibrahim, chioma, "Yes, that's easy to adjust.");

            saveReview(reviewRepository, booking4, sarah, daniel, 5, "Handled the event like a pro. Clear communication, smooth execution, zero stress.");
            saveReview(reviewRepository, booking5, aisha, linda, 5, "Sharp eye, fast turnaround, and the final brand kit felt premium.");

            saveNotification(notificationRepository, marcus, "New booking request", "Sarah Moyo requested your Marketplace MVP in 7 days listing.", "BOOKING", booking1.getId(), false, 0);
            saveNotification(notificationRepository, grace, "Counter offer pending", "Aisha Bello has a bridal booking waiting for your response.", "BOOKING", booking2.getId(), false, 1);
            saveNotification(notificationRepository, chioma, "Meal prep confirmed", "Ibrahim Kone confirmed your weekly executive meal prep booking.", "BOOKING", booking3.getId(), false, 0);
            saveNotification(notificationRepository, daniel, "New review received", "Sarah Moyo left you a 5-star review.", "REVIEW", booking4.getId(), true, 6);
            saveNotification(notificationRepository, linda, "New review received", "Aisha Bello left feedback on your luxury brand identity kit.", "REVIEW", booking5.getId(), false, 2);
            saveNotification(notificationRepository, zanele, "Booking cancelled", "Chioma Mensah cancelled the product campaign shoot request.", "BOOKING", booking6.getId(), true, 3);
            saveNotification(notificationRepository, marcus, "You gained a follower", "Chioma Mensah started following your profile.", "SOCIAL", marcusPlatform.getId(), false, 0);

            refreshTokenRepository.deleteAll();
        };
    }

    private void clearDatabase(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
        List.of(
                "comments",
                "stories",
                "post_comments",
                "post_likes",
                "direct_messages",
                "chat_messages",
                "reviews",
                "bookings",
                "notifications",
                "subscriptions",
                "follows",
                "dating_matches",
                "dating_profiles",
                "posts",
                "listings",
                "refresh_tokens",
                "vouches",
                "users"
        ).forEach(table -> {
            try {
                jdbcTemplate.execute("DELETE FROM " + table);
            } catch (Exception ignored) {
            }
        });
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");
    }

    private User saveUser(UserRepository userRepository, PasswordEncoder passwordEncoder, UserSeed seed) {
        return userRepository.save(User.builder()
                .email(seed.email())
                .password(passwordEncoder.encode("password123"))
                .fullName(seed.fullName())
                .phone(seed.phone())
                .role(seed.role())
                .avatarUrl(seed.avatarUrl())
                .shopBannerUrl(seed.bannerUrl())
                .bio(seed.bio())
                .city(seed.city())
                .emailVerified(seed.emailVerified())
                .phoneVerified(seed.phoneVerified())
                .idVerified(seed.idVerified())
                .vouchCount(seed.vouchCount())
                .lastActive(LocalDateTime.now().minusMinutes(seed.minutesAgo()))
                .build());
    }

    private Listing saveListing(ListingRepository listingRepository, User seller, String title, String description,
                                ListingType listingType, String price, String currency, boolean negotiable,
                                String city, String mediaUrls, String meta, ListingStatus status) {
        return listingRepository.save(Listing.builder()
                .sellerId(seller.getId())
                .title(title)
                .description(description)
                .listingType(listingType)
                .price(new BigDecimal(price))
                .currency(currency)
                .negotiable(negotiable)
                .locationCity(city)
                .mediaUrls(mediaUrls)
                .meta(meta)
                .status(status)
                .build());
    }

    private void saveFollow(FollowRepository followRepository, User follower, User following) {
        Follow follow = new Follow();
        follow.setFollowerId(follower.getId());
        follow.setFollowingId(following.getId());
        followRepository.save(follow);
    }

    private void saveSubscription(SubscriptionRepository subscriptionRepository, User seller, String plan,
                                  String status, String pricePerMonth, String currency, Integer expiresInDays) {
        Subscription subscription = Subscription.builder()
                .sellerId(seller.getId())
                .plan(plan)
                .status(status)
                .pricePerMonth(new BigDecimal(pricePerMonth))
                .currency(currency)
                .startedAt(LocalDateTime.now().minusDays(14))
                .expiresAt(expiresInDays == null ? null : LocalDateTime.now().plusDays(expiresInDays))
                .build();
        subscriptionRepository.save(subscription);
    }

    private void saveDatingProfile(DatingProfileRepository datingProfileRepository, User user, int age, String gender,
                                   String preferredGender, String lookingFor, String bio, String imageUrl) {
        DatingProfile profile = new DatingProfile();
        profile.setId(user.getId().toString());
        profile.setFullName(user.getFullName());
        profile.setAge(age);
        profile.setGender(gender);
        profile.setPreferredGender(preferredGender);
        profile.setLookingFor(lookingFor);
        profile.setLocation(user.getCity());
        profile.setBio(bio);
        profile.setImageUrl(imageUrl);
        datingProfileRepository.save(profile);
    }

    private Post savePost(PostRepository postRepository, User author, String content, String imageUrl,
                          Listing linkedListing, int likesCount, int commentsCount, int createdMinutesAgo) {
        Post post = new Post();
        post.setId(UUID.randomUUID().toString());
        post.setAuthorId(author.getId().toString());
        post.setAuthorName(author.getFullName());
        post.setContent(content);
        post.setImageUrl(imageUrl);
        post.setLinkedListingId(linkedListing != null ? linkedListing.getId().toString() : null);
        post.setLikesCount(likesCount);
        post.setCommentsCount(commentsCount);
        post.setCreatedAt(LocalDateTime.now().minusMinutes(createdMinutesAgo));
        return postRepository.save(post);
    }

    private void saveComment(CommentRepository commentRepository, Post post, User author, String content) {
        Comment comment = new Comment();
        comment.setId(UUID.randomUUID().toString());
        comment.setPostId(post.getId());
        comment.setAuthorId(author.getId().toString());
        comment.setAuthorName(author.getFullName());
        comment.setContent(content);
        commentRepository.save(comment);
    }

    private void saveStory(StoryRepository storyRepository, User author, Story.StoryType type, String content,
                           String mediaUrl, int hoursUntilExpiry) {
        Story story = new Story();
        story.setId(UUID.randomUUID().toString());
        story.setAuthorId(author.getId().toString());
        story.setAuthorName(author.getFullName());
        story.setType(type);
        story.setContent(content);
        story.setMediaUrl(mediaUrl);
        story.setCreatedAt(LocalDateTime.now().minusHours(1));
        story.setExpiresAt(LocalDateTime.now().plusHours(hoursUntilExpiry));
        storyRepository.save(story);
    }

    private Booking saveBooking(BookingRepository bookingRepository, User buyer, User seller, Listing listing,
                                BookingStatus status, String offeredPrice, String counterPrice,
                                String agreedPrice, int scheduledDaysOffset) {
        return bookingRepository.save(Booking.builder()
                .buyerId(buyer.getId())
                .sellerId(seller.getId())
                .listingId(listing.getId())
                .offeredPrice(new BigDecimal(offeredPrice))
                .counterPrice(counterPrice == null ? null : new BigDecimal(counterPrice))
                .agreedPrice(agreedPrice == null ? null : new BigDecimal(agreedPrice))
                .currency(listing.getCurrency())
                .scheduledAt(LocalDateTime.now().plusDays(scheduledDaysOffset))
                .status(status)
                .cancelReason(status == BookingStatus.CANCELLED ? "Client timeline changed" : null)
                .createdAt(LocalDateTime.now().minusDays(Math.max(1, Math.abs(scheduledDaysOffset))))
                .updatedAt(LocalDateTime.now().minusHours(4))
                .build());
    }

    private void saveChatMessage(ChatMessageRepository chatMessageRepository, Booking booking, User sender, String content) {
        chatMessageRepository.save(ChatMessage.builder()
                .bookingId(booking.getId())
                .senderId(sender.getId())
                .content(content)
                .messageType("TEXT")
                .createdAt(LocalDateTime.now().minusHours(2))
                .build());
    }

    private void saveDirectMessage(DirectMessageRepository directMessageRepository, User sender, User receiver, String content) {
        directMessageRepository.save(DirectMessage.builder()
                .senderId(sender.getId().toString())
                .receiverId(receiver.getId().toString())
                .content(content)
                .createdAt(LocalDateTime.now().minusHours(3))
                .build());
    }

    private void saveReview(ReviewRepository reviewRepository, Booking booking, User reviewer, User reviewed,
                            int rating, String comment) {
        reviewRepository.save(Review.builder()
                .bookingId(booking.getId())
                .reviewerId(reviewer.getId())
                .reviewedId(reviewed.getId())
                .rating(rating)
                .comment(comment)
                .createdAt(LocalDateTime.now().minusDays(1))
                .build());
    }

    private void saveNotification(NotificationRepository notificationRepository, User user, String title, String message,
                                  String notificationType, UUID referenceId, boolean read, int hoursAgo) {
        notificationRepository.save(Notification.builder()
                .userId(user.getId())
                .title(title)
                .message(message)
                .notificationType(notificationType)
                .referenceId(referenceId)
                .read(read)
                .createdAt(LocalDateTime.now().minusHours(hoursAgo))
                .build());
    }

    private String media(String... urls) {
        return String.join(",", urls);
    }

    private record UserSeed(
            String email,
            String fullName,
            Role role,
            String city,
            String phone,
            String bio,
            String avatarUrl,
            String bannerUrl,
            boolean emailVerified,
            boolean phoneVerified,
            boolean idVerified,
            int vouchCount,
            int minutesAgo) {
    }
}
