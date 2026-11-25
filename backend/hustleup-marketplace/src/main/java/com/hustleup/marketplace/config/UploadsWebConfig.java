package com.hustleup.marketplace.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * Serves locally stored uploads at {@code /uploads/**} when no S3/R2 bucket is configured.
 *
 * <p>The gateway rewrites {@code /uploads/marketplace/<file>} to this service's {@code /uploads/<file>},
 * but nothing here mapped that path, so every locally stored image routed to this service
 * answered 500 ("No static resource"). Mirrors the social service's WebConfig.
 */
@Configuration
public class UploadsWebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        String uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize().toString();
        registry.addResourceHandler("/uploads/**").addResourceLocations("file:" + uploadPath + "/");
    }
}
