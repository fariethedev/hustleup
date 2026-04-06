/**
 * Spring MVC web configuration for the HustleUp Social service.
 *
 * <p>This configuration class customises Spring MVC's default behaviour by registering
 * a static resource handler that serves uploaded files directly over HTTP.
 *
 * <h2>Why is this needed?</h2>
 * When the application is configured to store uploaded files on the local filesystem
 * (the default for development), those files live in a directory outside the web
 * application's classpath (e.g. {@code ./uploads/}).  By default, Spring Boot does not
 * serve files from arbitrary filesystem locations — it only serves static resources from
 * the classpath ({@code /static}, {@code /public}, etc.).
 *
 * <p>This configuration tells Spring MVC: "any request to {@code /uploads/**}} should
 * be served from the directory at {@code <uploadDir>}."
 *
 * <h2>Production vs. development</h2>
 * In production, uploaded files would typically be stored in S3 and served directly
 * from the S3/CDN URL — in that case this resource handler is never invoked.
 * In development, it makes it easy to view uploaded images without running a separate
 * static file server.
 *
 * <h2>{@code @Configuration}</h2>
 * Marks this class as a Spring configuration class.  Spring will call
 * {@link #addResourceHandlers} during MVC setup, before the application starts
 * accepting requests.
 */
package com.hustleup.social.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

// @Configuration: tells Spring to process this class for bean definitions and
// to call its WebMvcConfigurer methods during MVC auto-configuration.
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * The filesystem directory where uploaded files are stored.
     *
     * <p>{@code @Value} reads this from the application configuration.
     * The {@code :./uploads} suffix provides a default of {@code ./uploads}
     * (relative to the working directory) if the property is not explicitly set.
     *
     * <p>Override in {@code application.properties} with:
     * {@code app.upload.dir=/var/hustleup/uploads}
     */
    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    /**
     * Registers a static resource handler that maps HTTP path {@code /uploads/**}
     * to the configured upload directory on the filesystem.
     *
     * <p>How it works:
     * <ol>
     *   <li>{@code addResourceHandler("/uploads/**")} — match all requests under {@code /uploads/}.</li>
     *   <li>{@code addResourceLocations("file:" + path + "/")} — serve from the filesystem
     *       ({@code "file:"} prefix tells Spring this is a filesystem path, not a classpath resource).</li>
     *   <li>{@code Paths.get(uploadDir).toAbsolutePath().normalize()} — converts a relative path
     *       like {@code ./uploads} to an absolute OS path (e.g. {@code /home/app/uploads}) so
     *       the file protocol resolves correctly on all operating systems.</li>
     * </ol>
     *
     * <p>Example: a file stored at {@code ./uploads/abc123.jpg} would be accessible at
     * {@code http://localhost:8082/uploads/abc123.jpg}.
     *
     * @param registry the Spring MVC resource handler registry to add mappings to
     */
    @Override
    public void addResourceHandlers(@org.springframework.lang.NonNull ResourceHandlerRegistry registry) {
        // Convert the (possibly relative) upload path to an absolute, normalised path.
        String uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize().toString();

        registry.addResourceHandler("/uploads/**")       // match all /uploads/* requests
                .addResourceLocations("file:" + uploadPath + "/"); // serve from filesystem
    }
}
