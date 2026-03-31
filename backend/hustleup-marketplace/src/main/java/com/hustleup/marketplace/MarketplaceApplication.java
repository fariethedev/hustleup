package com.hustleup.marketplace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "com.hustleup.common.repository")
@EntityScan(basePackages = {"com.hustleup.common.model", "com.hustleup.marketplace.model"})
@ComponentScan(basePackages = {"com.hustleup.marketplace", "com.hustleup.common"})
public class MarketplaceApplication {
    public static void main(String[] args) {
        SpringApplication.run(MarketplaceApplication.class, args);
    }
}
