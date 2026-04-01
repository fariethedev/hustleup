package com.hustleup.social;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {"com.hustleup.common.repository", "com.hustleup.social.repository"})
@EntityScan(basePackages = {"com.hustleup.common.model", "com.hustleup.social.model"})
@ComponentScan(basePackages = {"com.hustleup.social", "com.hustleup.common"})
public class SocialApplication {
    public static void main(String[] args) {
        SpringApplication.run(SocialApplication.class, args);
    }
}
