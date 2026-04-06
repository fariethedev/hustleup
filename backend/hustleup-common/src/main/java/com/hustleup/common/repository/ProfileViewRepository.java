package com.hustleup.common.repository;

import com.hustleup.common.model.ProfileView;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Spring Data JPA repository for {@link ProfileView} entities.
 *
 * <p><b>Responsibility:</b><br>
 * Manages database access for the {@code profile_views} table, which records which users
 * have looked at which profiles. Beyond standard CRUD, this interface provides three
 * custom methods that drive the "Who viewed my profile" feature.
 *
 * <p><b>Generic parameters:</b><br>
 * {@code JpaRepository<ProfileView, String>} — manages {@link ProfileView} entities
 * whose primary key is a {@code String} (a serialised UUID).
 *
 * <p><b>Architecture note:</b><br>
 * The unique constraint {@code (profile_id, viewer_id)} on the underlying table (declared
 * in {@link ProfileView}) means each (viewer → profile) pair can exist at most once. The
 * typical "record a view" flow therefore uses {@link #existsByProfileIdAndViewerId} to
 * check, then {@link #deleteByProfileIdAndViewerId} + save to refresh the timestamp.
 *
 * <p><b>Transaction note:</b><br>
 * {@link #deleteByProfileIdAndViewerId} performs a DELETE and is automatically wrapped in
 * a transaction by Spring Data when the calling service method is annotated with
 * {@code @Transactional}.
 */
public interface ProfileViewRepository extends JpaRepository<ProfileView, String> {

    /**
     * Retrieves all recorded views for a given profile, newest first.
     *
     * <p><b>What it returns:</b><br>
     * Every {@link ProfileView} row where {@code profile_id} matches the supplied
     * {@code profileId}, ordered by {@code viewed_at DESC} (most recent viewer first).
     *
     * <p><b>Why it's needed:</b><br>
     * Powers the "Who viewed my profile" list shown on a seller's dashboard. The result
     * is typically mapped to a lightweight DTO that includes viewer name and avatar before
     * being sent to the frontend.
     *
     * <p><b>Derived query translation:</b><br>
     * {@code findByProfileIdOrderByViewedAtDesc} →
     * {@code SELECT pv FROM ProfileView pv WHERE pv.profileId = :profileId ORDER BY pv.viewedAt DESC}
     *
     * @param profileId the ID of the profile whose viewers are requested
     * @return list of profile view records ordered by most recent; empty list if none
     */
    List<ProfileView> findByProfileIdOrderByViewedAtDesc(String profileId);

    /**
     * Checks whether a specific user has already viewed a specific profile.
     *
     * <p><b>What it returns:</b><br>
     * {@code true} if a row exists where both {@code profile_id} and {@code viewer_id}
     * match; {@code false} otherwise.
     *
     * <p><b>Why it's needed:</b><br>
     * Before inserting a new view record, the service layer calls this method to decide
     * whether to delete the old record first (so the {@code viewed_at} timestamp is
     * refreshed to "now") or to insert a brand-new record. Without this check we would
     * violate the composite UNIQUE constraint and get a database exception.
     *
     * <p><b>Derived query translation:</b><br>
     * {@code existsByProfileIdAndViewerId} →
     * {@code SELECT CASE WHEN COUNT(pv) > 0 THEN TRUE ELSE FALSE END
     * FROM ProfileView pv WHERE pv.profileId = :profileId AND pv.viewerId = :viewerId}
     *
     * @param profileId the profile owner's user ID
     * @param viewerId  the visiting user's ID
     * @return {@code true} if the view record already exists
     */
    boolean existsByProfileIdAndViewerId(String profileId, String viewerId);

    /**
     * Deletes the view record for a specific (profile, viewer) pair.
     *
     * <p><b>What it does:</b><br>
     * Removes the row from {@code profile_views} where both {@code profile_id} and
     * {@code viewer_id} match. At most one row is deleted (enforced by the unique
     * constraint).
     *
     * <p><b>Why it's needed:</b><br>
     * When the same user visits a profile a second (or nth) time, the service refreshes
     * the {@code viewed_at} timestamp by deleting the existing record and saving a new
     * one. This keeps the "last viewed" time accurate without accumulating duplicate rows.
     * It is also used if the platform ever needs to allow a user to "hide" their view
     * from a profile owner.
     *
     * <p><b>Important — requires {@code @Transactional}:</b><br>
     * Spring Data DELETE methods must be called from within a transaction. The calling
     * service method must be annotated with {@code @Transactional}, or Spring will throw
     * a {@code TransactionRequiredException} at runtime.
     *
     * <p><b>Derived query translation:</b><br>
     * {@code deleteByProfileIdAndViewerId} →
     * {@code DELETE FROM ProfileView pv WHERE pv.profileId = :profileId AND pv.viewerId = :viewerId}
     *
     * @param profileId the profile owner's user ID
     * @param viewerId  the viewing user's ID
     */
    void deleteByProfileIdAndViewerId(String profileId, String viewerId);
}
