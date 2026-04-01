package com.hustleup.subscription;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {"com.hustleup.common.repository", "com.hustleup.subscription.repository"})
@EntityScan(basePackages = {"com.hustleup.common.model", "com.hustleup.subscription.model"})
@ComponentScan(basePackages = {"com.hustleup.subscription", "com.hustleup.common"})
public class SubscriptionApplication {
    public static void main(String[] args) {
        SpringApplication.run(SubscriptionApplication.class, args);
    }
}
