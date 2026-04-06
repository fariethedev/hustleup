/**
 * Spring Cache configuration for the HustleUp Social service.
 *
 * <h2>Why Redis caching?</h2>
 * The feed endpoint ({@code GET /api/v1/feed}) is the most frequently called endpoint
 * in the service.  Without caching, every request would query MySQL, filter, sort,
 * and convert all posts.  Redis caching reduces database load dramatically:
 * <ul>
 *   <li>A feed response is cached in Redis after the first request.</li>
 *   <li>Subsequent requests are served from Redis (sub-millisecond) instead of MySQL.</li>
 *   <li>The cache is invalidated (evicted) when a post is created or liked, ensuring
 *       freshness.</li>
 * </ul>
 *
 * <h2>How Spring Cache works</h2>
 * Spring Cache is an abstraction layer over any cache provider (Redis, Caffeine,
 * Ehcache, etc.).  You annotate methods with:
 * <ul>
 *   <li>{@code @Cacheable} — cache the return value; return it from cache on subsequent calls.</li>
 *   <li>{@code @CacheEvict} — delete entries from the cache (used after mutations).</li>
 * </ul>
 * The actual cache provider is configured in {@code application.properties} via
 * {@code spring.cache.type=redis} and {@code spring.redis.host}.
 *
 * <h2>Resilience: lenient error handler</h2>
 * This configuration provides a custom {@link org.springframework.cache.interceptor.CacheErrorHandler}
 * that silently ignores Redis errors.  This means:
 * <ul>
 *   <li>If Redis is down, the application continues to work — it just hits the database.</li>
 *   <li>A Redis outage never causes a user-visible error.</li>
 *   <li>Redis is treated as an optional performance enhancement, not a hard dependency.</li>
 * </ul>
 */
package com.hustleup.social.config;

import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Configuration;

// @Configuration: marks this class as a source of Spring bean definitions.
// Spring will process it at startup and register any @Bean methods.
@Configuration

// @EnableCaching: activates the @Cacheable / @CacheEvict annotations.
// Without this, those annotations on controller methods would be ignored.
@EnableCaching
public class CacheConfig implements CachingConfigurer {

    /**
     * Provides a custom error handler that silently swallows all Redis cache failures.
     *
     * <p>{@link CachingConfigurer} is a Spring interface with optional override methods.
     * By overriding {@code errorHandler()}, we replace the default handler
     * (which would re-throw exceptions) with one that treats Redis errors as no-ops.
     *
     * <p>There are four operations that can fail:
     * <ul>
     *   <li>{@code GET} — cache miss on Redis error → proceed with DB query</li>
     *   <li>{@code PUT} — cache write fails → item just won't be cached</li>
     *   <li>{@code EVICT} — cache eviction fails → stale data may remain temporarily</li>
     *   <li>{@code CLEAR} — cache clear fails → same as evict failure</li>
     * </ul>
     *
     * @return a no-op CacheErrorHandler
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {

            /**
             * Called when a cache GET (read) fails.
             *
             * <p>Swallowing this means the request proceeds normally to the database,
             * as if the cache had a miss.  The user gets a valid response, just slower.
             *
             * @param e     the Redis exception (e.g. connection refused)
             * @param cache the cache that failed
             * @param key   the cache key that was being looked up
             */
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                // Redis unavailable — cache miss, continue with DB query
            }

            /**
             * Called when a cache PUT (write) fails.
             *
             * <p>Swallowing this means the computed value is returned to the caller
             * but not stored in Redis.  The next request will hit the DB again.
             *
             * @param e     the Redis exception
             * @param cache the cache that failed
             * @param key   the cache key that was being written
             * @param value the value that failed to be cached
             */
            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                // Redis unavailable — skip caching; response still returned to caller
            }

            /**
             * Called when a cache EVICT (invalidation) fails.
             *
             * <p>Swallowing this means a stale cache entry may remain temporarily.
             * On the next cache hit, stale data may be served until Redis recovers
             * and the cache is evicted correctly.  Acceptable trade-off for resilience.
             *
             * @param e     the Redis exception
             * @param cache the cache that failed
             * @param key   the cache key that failed to be evicted
             */
            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                // Redis unavailable — skip eviction; stale data may persist briefly
            }

            /**
             * Called when a full cache CLEAR fails.
             *
             * <p>Same trade-off as eviction failure — temporary stale data is
             * acceptable in exchange for never crashing on a Redis outage.
             *
             * @param e     the Redis exception
             * @param cache the cache that failed to be cleared
             */
            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                // Redis unavailable — skip clear; stale data may persist briefly
            }
        };
    }
}
