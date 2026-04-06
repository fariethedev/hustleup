/**
 * Entry point for the HustleUp Notification microservice.
 *
 * <p>This service is responsible for two closely related concerns:
 * <ol>
 *   <li><strong>Notifications</strong> – persisting and serving in-app alerts
 *       (e.g. "You have a new booking request") to the front-end via REST.</li>
 *   <li><strong>Real-time messaging</strong> – handling both WebSocket-based
 *       booking chat ({@code ChatController}) and HTTP-based direct messages
 *       ({@code DirectMessageController}).</li>
 * </ol>
 *
 * <p><strong>Why a separate microservice?</strong><br>
 * Notifications and messaging are high-frequency, I/O-bound workloads.
 * Isolating them in their own service lets the team scale this pod independently
 * without touching the core booking or user logic.
 *
 * <p><strong>Package layout:</strong>
 * <ul>
 *   <li>{@code com.hustleup.notification.*} – Spring Boot bootstrap + REST
 *       controllers for notifications.</li>
 *   <li>{@code com.hustleup.messaging.*} – models, repositories, controllers,
 *       and DTOs for direct messages and booking chat.</li>
 *   <li>{@code com.hustleup.common.*} – shared entities (User, Notification)
 *       and their repositories; lives in a separate shared library JAR but is
 *       pulled in and scanned here.</li>
 * </ul>
 */
package com.hustleup.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

/**
 * {@code @SpringBootApplication} is a convenience meta-annotation that bundles
 * three annotations together:
 * <ul>
 *   <li>{@code @Configuration} – marks this class as a source of Spring bean definitions.</li>
 *   <li>{@code @EnableAutoConfiguration} – tells Spring Boot to automatically
 *       configure beans based on the JARs on the classpath (e.g. it sees
 *       spring-data-jpa and sets up a DataSource).</li>
 *   <li>{@code @ComponentScan} – scans for {@code @Component}, {@code @Service},
 *       {@code @Controller}, etc. in the specified base packages.</li>
 * </ul>
 */
@SpringBootApplication

/**
 * {@code @EnableJpaRepositories} tells Spring Data JPA where to look for
 * repository interfaces (those that extend {@code JpaRepository}).
 *
 * <p>By default, Spring Boot only scans the package that contains this class
 * ({@code com.hustleup.notification}) and its sub-packages.  Because the
 * repositories for the shared common library and the messaging feature live in
 * different root packages, we must explicitly list them here; otherwise Spring
 * would fail to create the repository beans and the application would not start.
 */
@EnableJpaRepositories(basePackages = {
    "com.hustleup.common.repository",    // Notification & User repositories from the shared lib
    "com.hustleup.messaging.repository"  // DirectMessage & ChatMessage repositories
})

/**
 * {@code @EntityScan} tells Hibernate (the JPA provider) where to look for
 * classes annotated with {@code @Entity} so it can map them to database tables.
 *
 * <p>Same reasoning as {@code @EnableJpaRepositories} above – we need to
 * explicitly list packages outside this service's own root package.
 */
@EntityScan(basePackages = {
    "com.hustleup.common.model",    // Shared entities: User, Notification
    "com.hustleup.messaging.model"  // Messaging entities: DirectMessage, ChatMessage
})

/**
 * {@code @ComponentScan} extends the default component scan to include the
 * messaging and common packages so that their {@code @Service}, {@code @RestController},
 * and {@code @Configuration} beans are picked up and registered in the
 * Spring application context.
 */
@ComponentScan(basePackages = {
    "com.hustleup.notification", // Notification controllers, config (WebSocketConfig, etc.)
    "com.hustleup.messaging",    // DirectMessageController, ChatController, and supporting beans
    "com.hustleup.common"        // Shared security, utilities, and service beans
})
public class NotificationApplication {

    /**
     * Application entry point.
     *
     * <p>{@code SpringApplication.run()} bootstraps the entire Spring context:
     * <ol>
     *   <li>Creates an {@code ApplicationContext}.</li>
     *   <li>Registers all beans found by component scan and auto-configuration.</li>
     *   <li>Starts the embedded Tomcat (or Netty) web server.</li>
     *   <li>Runs any {@code CommandLineRunner} / {@code ApplicationRunner} beans.</li>
     * </ol>
     *
     * @param args command-line arguments forwarded by the JVM; Spring Boot
     *             supports property overrides via these (e.g.
     *             {@code --server.port=9090}).
     */
    public static void main(String[] args) {
        SpringApplication.run(NotificationApplication.class, args);
    }
}
