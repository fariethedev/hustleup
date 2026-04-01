package com.hustleup.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@EnableJpaRepositories(basePackages = {
    "com.hustleup.common.repository",
    "com.hustleup.notification.repository",
    "com.hustleup.messaging.repository"
})
@EntityScan(basePackages = {
    "com.hustleup.common.model",
    "com.hustleup.notification.model",
    "com.hustleup.messaging.model"
})
@ComponentScan(basePackages = {
    "com.hustleup.notification",
    "com.hustleup.messaging",
    "com.hustleup.common"
})
public class NotificationApplication {
    public static void main(String[] args) {
        SpringApplication.run(NotificationApplication.class, args);
    }
}
