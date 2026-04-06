/**
 * Spring Data JPA repository for {@link Listing} entities.
 *
 * <p>By extending {@link JpaRepository}, Spring automatically generates a full CRUD
 * implementation at startup — no boilerplate {@code EntityManager} code required.
 * Out of the box we get: {@code save}, {@code findById}, {@code findAll}, {@code delete},
 * {@code count}, and many more.
 *
 * <p>Additional query methods are declared here in two ways:
 * <ol>
 *   <li><b>Derived query methods</b> — Spring parses the method name
 *       (e.g. {@code findBySellerIdAndStatusNot}) and generates the JPQL automatically.
 *       No SQL or JPQL code is needed.</li>
 *   <li><b>Custom {@code @Query} methods</b> — For more complex filters or sorting we
 *       write JPQL (Java Persistence Query Language) explicitly. JPQL looks like SQL but
 *       refers to Java class and field names rather than table/column names.</li>
 * </ol>
 *
 * <p>All methods that could be called from a public API should return only
 * {@code ACTIVE} listings unless the caller explicitly needs all statuses (e.g. a seller
 * viewing their own dashboard).
 */
package com.hustleup.listing.repository;

import com.hustleup.listing.model.Listing;
import com.hustleup.listing.model.ListingStatus;
import com.hustleup.listing.model.ListingType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

// JpaRepository<Listing, UUID> tells Spring:
//   - the entity type being managed is Listing
//   - the primary key type is UUID
// Spring generates an implementation class at startup using a JDK proxy.
public interface ListingRepository extends JpaRepository<Listing, UUID> {

    /**
     * Returns all listings by a given seller that are NOT in the specified status.
     *
     * <p>Spring derives the SQL from the method name:
     * {@code findBy} + {@code SellerId} (field) + {@code And} + {@code StatusNot} (≠ operator).
     * Useful for a seller's dashboard where they want to see everything except deleted listings.
     *
     * @param sellerId the UUID of the seller
     * @param status   the status to exclude (e.g. {@link ListingStatus#DELETED})
     * @return list of matching listings, may be empty
     */
    List<Listing> findBySellerIdAndStatusNot(UUID sellerId, ListingStatus status);

    /**
     * Returns ALL listings by a given seller regardless of status.
     *
     * <p>Used internally when a seller needs to see their complete history including
     * paused and deleted listings.
     *
     * @param sellerId the UUID of the seller
     * @return all listings belonging to the seller, may be empty
     */
    List<Listing> findBySellerId(UUID sellerId);

    /**
     * Counts how many listings a seller has in a given status.
     *
     * <p>Used to enforce business rules, e.g. a seller can have at most N active listings
     * on a free-tier account (not yet enforced but the hook is here).
     *
     * @param sellerId the UUID of the seller
     * @param status   the status to count (e.g. {@link ListingStatus#ACTIVE})
     * @return the number of matching listings
     */
    int countBySellerIdAndStatus(UUID sellerId, ListingStatus status);

    /**
     * Returns all active listings that match optional filter criteria, sorted by newest first.
     *
     * <p>The {@code :type IS NULL OR l.listingType = :type} pattern is a common JPQL trick:
     * when a parameter is {@code null} the condition is always true (i.e. the filter is ignored),
     * so the same query serves both "no filter" and "with filter" requests.
     *
     * <p>{@code LOWER(...) LIKE LOWER(CONCAT('%', :city, '%'))} is a case-insensitive
     * substring match — it finds listings in "London" when the user types "london" or "LOND".
     *
     * @param type       filter by listing type, or {@code null} to include all types
     * @param city       filter by city (case-insensitive partial match), or {@code null}
     * @param maxPrice   filter to listings priced at or below this amount, or {@code null}
     * @param negotiable filter by negotiability, or {@code null} to include both
     * @return list of matching active listings, ordered by {@code createdAt} descending
     */
    @Query("SELECT l FROM Listing l WHERE l.status = 'ACTIVE' " +
           "AND (:type IS NULL OR l.listingType = :type) " +
           "AND (:city IS NULL OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :city, '%'))) " +
           "AND (:maxPrice IS NULL OR l.price <= :maxPrice) " +
           "AND (:negotiable IS NULL OR l.negotiable = :negotiable) " +
           "ORDER BY l.createdAt DESC")
    List<Listing> findWithFilters(@Param("type") ListingType type,
                                  @Param("city") String city,
                                  @Param("maxPrice") BigDecimal maxPrice,
                                  @Param("negotiable") Boolean negotiable);

    /**
     * Same as {@link #findWithFilters} but sorted by price ascending (cheapest first).
     *
     * <p>Having two separate queries (instead of a dynamic {@code ORDER BY} clause) is
     * intentional: JPQL does not support a {@code :sort} parameter in the ORDER BY clause,
     * so we duplicate the query with a different ORDER BY. This keeps each query simple
     * and easy to understand.
     *
     * @param type       filter by listing type, or {@code null}
     * @param city       filter by city, or {@code null}
     * @param maxPrice   filter to listings at or below this price, or {@code null}
     * @param negotiable filter by negotiability, or {@code null}
     * @return list of matching active listings, ordered by {@code price} ascending
     */
    @Query("SELECT l FROM Listing l WHERE l.status = 'ACTIVE' " +
           "AND (:type IS NULL OR l.listingType = :type) " +
           "AND (:city IS NULL OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :city, '%'))) " +
           "AND (:maxPrice IS NULL OR l.price <= :maxPrice) " +
           "AND (:negotiable IS NULL OR l.negotiable = :negotiable) " +
           "ORDER BY l.price ASC")
    List<Listing> findWithFiltersSortByPrice(@Param("type") ListingType type,
                                              @Param("city") String city,
                                              @Param("maxPrice") BigDecimal maxPrice,
                                              @Param("negotiable") Boolean negotiable);

    /**
     * Full-text keyword search across title, description, and city (case-insensitive).
     *
     * <p>This is a simple {@code LIKE}-based search rather than a dedicated full-text index.
     * It is sufficient for an MVP but would be replaced by Elasticsearch or PostgreSQL
     * full-text search at scale (LIKE with a leading wildcard cannot use a B-tree index).
     *
     * @param query the search keyword(s); a single string matched as a substring
     * @return active listings whose title, description, or city contains the query string
     */
    @Query("SELECT l FROM Listing l WHERE l.status = 'ACTIVE' " +
           "AND (LOWER(l.title) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(l.description) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(l.locationCity) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY l.createdAt DESC")
    List<Listing> search(@Param("q") String query);
}
