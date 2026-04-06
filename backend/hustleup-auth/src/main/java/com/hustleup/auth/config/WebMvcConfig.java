package com.hustleup.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * WebMvcConfig — customises Spring MVC's web layer to serve user-uploaded files
 * as static resources over HTTP.
 *
 * <h2>Why does this class exist?</h2>
 * <p>When a user uploads an avatar or shop banner, {@link com.hustleup.common.storage.FileStorageService}
 * saves the file to a directory on the local filesystem (configured via
 * {@code app.upload.dir} in {@code application.properties}). But saving the file
 * is only half the story — the client also needs to download it via a URL.</p>
 *
 * <p>By default, Spring Boot only serves static files from well-known classpath
 * locations ({@code /static}, {@code /public}, {@code /resources}, etc.).
 * A runtime uploads directory is outside the classpath, so it won't be served
 * automatically. This configuration adds a custom resource handler that maps
 * HTTP requests for {@code /uploads/**} to the configured filesystem directory.</p>
 *
 * <h2>How WebMvcConfigurer works</h2>
 * <p>{@link WebMvcConfigurer} is a callback interface provided by Spring MVC.
 * By implementing it and annotating the class with {@code @Configuration}, Spring
 * automatically detects it and calls each overridden method during startup to
 * customise the MVC setup. You only override the methods you need — the default
 * implementations are all no-ops.</p>
 *
 * <h2>Production note</h2>
 * <p>Serving files from the local filesystem works well for a single-server
 * deployment. For a production multi-instance setup you would replace this with a
 * cloud object store (e.g., AWS S3 / Azure Blob) and a CDN, updating
 * {@code FileStorageService} to upload there instead.</p>
 */
// @Configuration marks this class as a source of bean definitions and configuration.
// Spring processes it at startup, calls the overridden WebMvcConfigurer callbacks,
// and incorporates the customisations into the DispatcherServlet setup.
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    /**
     * The filesystem path where uploaded files are stored.
     *
     * <p>{@code @Value("${app.upload.dir:./uploads}")} injects the value of the
     * {@code app.upload.dir} property from {@code application.properties} (or
     * environment variables, system properties, etc.). The part after the colon
     * ({@code ./uploads}) is the <em>default value</em> used if the property is
     * not set — useful for local development where you haven't configured the path.</p>
     */
    // @Value is Spring's property injection mechanism. It evaluates the expression
    // at startup and injects the result into this field. The SpEL syntax is:
    //   ${propertyKey:defaultValue}
    @Value("${app.upload.dir:./uploads}")
    private String uploadDir; // relative or absolute path to the uploads directory on disk

    /**
     * Register a resource handler that serves files from the uploads directory over HTTP.
     *
     * <p>After this method runs, a request for {@code GET /uploads/avatars/photo.jpg}
     * will be resolved to the file {@code <uploadDir>/avatars/photo.jpg} on disk and
     * served as a static resource — no controller or business logic involved.</p>
     *
     * <p>Spring MVC checks resource handlers <em>before</em> routing to controllers,
     * so these static file requests never reach the DispatcherServlet's handler mapping.</p>
     *
     * @param registry the Spring MVC resource handler registry to add handlers to
     */
    // @Override confirms we are implementing the WebMvcConfigurer interface method.
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Convert the configured path (which may be relative, e.g., "./uploads") to an
        // absolute, canonical path. This is important because:
        //   1. Relative paths depend on the working directory at runtime, which can vary.
        //   2. toAbsolutePath() resolves it relative to the JVM's working directory.
        //   3. normalize() removes redundant path segments like "." and "..".
        //   4. replace("\\", "/") ensures forward slashes for the "file:" URI on Windows,
        //      where Paths.toString() uses backslashes but Spring's resource URL requires slashes.
        String absolutePath = Paths.get(uploadDir)
                .toAbsolutePath()
                .normalize()
                .toString()
                .replace("\\", "/"); // normalise path separator for the file: URI scheme

        // addResourceHandler("/uploads/**") declares the URL pattern to match.
        // The "**" is an Ant-style wildcard that matches any path under /uploads/,
        // including subdirectories (e.g., /uploads/avatars/123.png).
        // addResourceLocations("file:<path>/") tells Spring where to find the files.
        // The "file:" prefix means "this is a filesystem path" (as opposed to
        // "classpath:" which would look inside the JAR). The trailing "/" is required.
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + absolutePath + "/");
    }
}
