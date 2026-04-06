package com.hustleup.subscription;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

/**
 * Entry point for the HustleUp Subscription microservice.
 *
 * <p>This is a standalone Spring Boot application responsible for managing seller
 * subscription plans and processing payments via Stripe. In a microservices
 * architecture, each concern (users, listings, subscriptions, etc.) lives in its
 * own deployable service so teams can develop, scale, and deploy them independently.</p>
 *
 * <h2>Why a separate service?</h2>
 * <ul>
 *   <li>Billing logic is complex and changes frequently; isolation prevents it from
 *       destabilising other services.</li>
 *   <li>PCI-DSS compliance is easier to scope when payment code is contained.</li>
 *   <li>The service can be scaled independently during high-traffic payment events.</li>
 * </ul>
 *
 * <h2>Shared code ("common" module)</h2>
 * <p>HustleUp uses a {@code hustleup-common} library that holds shared JPA entities
 * (e.g. {@code User}) and repositories used by multiple services. The three
 * annotation overrides below tell Spring where to look for those shared classes
 * in addition to the classes that live directly inside this service.</p>
 */
// @SpringBootApplication combines @Configuration, @EnableAutoConfiguration, and
// @ComponentScan into one convenience annotation. It bootstraps the Spring context,
// auto-wires beans, and scans the current package for components.
// The explicit @ComponentScan below overrides the default scan so that shared
// beans from the 'common' module are also discovered.
@SpringBootApplication

// Tells Spring Data JPA where to find Repository interfaces. Without this,
// Spring would only look inside 'com.hustleup.subscription.repository' and would
// miss the UserRepository that lives in the shared common module.
@EnableJpaRepositories(basePackages = {"com.hustleup.common.repository", "com.hustleup.subscription.repository"})

// Tells Hibernate where to find @Entity classes. Without this, the shared User
// entity (and any other common models) would not be registered, causing a
// "No entity named 'User'" error at runtime.
@EntityScan(basePackages = {"com.hustleup.common.model", "com.hustleup.subscription.model"})

// Extends the default component scan to include beans defined in the common module
// (e.g. shared services, configuration classes, security filters).
@ComponentScan(basePackages = {"com.hustleup.subscription", "com.hustleup.common"})
public class SubscriptionApplication {

    /**
     * Application entry point.
     *
     * <p>{@link SpringApplication#run} bootstraps the entire Spring context:
     * it reads {@code application.properties}, wires all beans, starts an embedded
     * Tomcat server, and begins listening for HTTP requests. The {@code args} array
     * allows command-line arguments (e.g. {@code --server.port=8082}) to override
     * any property at startup time.</p>
     *
     * @param args command-line arguments forwarded from the OS / container runtime
     */
    public static void main(String[] args) {
        // SpringApplication.run is the canonical way to launch a Spring Boot app.
        // It returns a ConfigurableApplicationContext but we discard it here
        // because the service is designed to run until the JVM is terminated.
        SpringApplication.run(SubscriptionApplication.class, args);
    }
}
