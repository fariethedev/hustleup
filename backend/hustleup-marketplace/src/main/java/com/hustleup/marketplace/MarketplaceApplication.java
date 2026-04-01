package com.hustleup.marketplace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

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
}
