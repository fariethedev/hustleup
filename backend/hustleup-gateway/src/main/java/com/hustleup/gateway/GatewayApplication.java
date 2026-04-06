package com.hustleup.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the HustleUp API Gateway service.
 *
 * <h2>What is an API Gateway?</h2>
 * <p>In a microservices architecture, each business capability (users, listings,
 * subscriptions, notifications) runs as its own independently deployable service,
 * each listening on a different port or internal hostname. Without a gateway, a
 * frontend would need to know the address of every single service and make direct
 * calls to each one. That creates tight coupling and security headaches.</p>
 *
 * <p>An API Gateway is a single entry-point that sits in front of all the
 * microservices. Every request from the frontend or mobile app goes to the gateway
 * first; the gateway then forwards it to the appropriate downstream service based
 * on the request path, then streams the response back to the caller.</p>
 *
 * <h2>Why Spring Cloud Gateway?</h2>
 * <p>Spring Cloud Gateway is the modern, reactive (non-blocking) gateway built on
 * Spring WebFlux and Project Reactor. Key advantages over older solutions:</p>
 * <ul>
 *   <li><b>Routing:</b> Declarative route configuration in {@code application.yml} —
 *       no boilerplate code needed to add a new route.</li>
 *   <li><b>Filters:</b> Pre/post filters can add headers, strip path prefixes, enforce
 *       rate limits, validate JWTs, or inject correlation IDs before forwarding.</li>
 *   <li><b>Non-blocking:</b> Built on Netty rather than Tomcat, so it can handle
 *       thousands of concurrent connections with a small thread pool — ideal for a
 *       gateway that does mostly I/O forwarding.</li>
 * </ul>
 *
 * <h2>What routing does this gateway perform?</h2>
 * <p>Routes are defined in {@code src/main/resources/application.yml}. Typical
 * routing rules for HustleUp follow this pattern:</p>
 * <pre>
 *   /api/v1/subscriptions/** → http://hustleup-subscription:8082
 *   /api/v1/users/**         → http://hustleup-user:8081
 *   /api/v1/listings/**      → http://hustleup-listing:8083
 * </pre>
 * <p>The gateway strips or rewrites path prefixes as needed so each downstream
 * service can use its own clean URL namespace.</p>
 *
 * <h2>Cross-cutting concerns</h2>
 * <p>Because every request passes through the gateway, it is the ideal place to
 * implement concerns that apply to all services:</p>
 * <ul>
 *   <li>JWT validation (authenticate once, forward identity headers downstream)</li>
 *   <li>CORS configuration (one place instead of every service)</li>
 *   <li>Rate limiting (protect services from abuse)</li>
 *   <li>Request/response logging and distributed tracing</li>
 * </ul>
 *
 * <h2>Deployment topology</h2>
 * <p>In Docker Compose or Kubernetes, only the gateway's port is exposed to the
 * outside world. All microservices communicate on an internal network and are never
 * directly reachable from the internet — the gateway acts as the sole ingress point.</p>
 */
// @SpringBootApplication bootstraps the Spring context, enables auto-configuration,
// and triggers a component scan of this package. Spring Cloud Gateway's auto-
// configuration (pulled in via the spring-cloud-starter-gateway dependency in
// pom.xml/build.gradle) is activated automatically — no additional annotations needed.
@SpringBootApplication
public class GatewayApplication {

    /**
     * Application entry point.
     *
     * <p>Starts the embedded Netty server (not Tomcat — Spring Cloud Gateway requires
     * the reactive web stack) and loads all route definitions from
     * {@code application.yml}. The gateway is ready to accept and proxy requests
     * as soon as this method returns.</p>
     *
     * <p>The reactive runtime (Project Reactor / Netty) means the gateway handles
     * incoming connections on a small number of event-loop threads rather than
     * one thread per request. This is critical for a gateway that may proxy hundreds
     * of concurrent requests to multiple backend services simultaneously.</p>
     *
     * @param args command-line arguments; can override any property at startup
     *             (e.g. {@code --server.port=8080})
     */
    public static void main(String[] args) {
        // SpringApplication.run starts the reactive Netty server, loads routes from
        // application.yml, and begins forwarding traffic to downstream services.
        SpringApplication.run(GatewayApplication.class, args);
    }
}
