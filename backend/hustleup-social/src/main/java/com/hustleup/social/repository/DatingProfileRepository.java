/**
 * Spring Data JPA repository for {@link com.hustleup.social.model.DatingProfile} entities.
 *
 * <p>Provides CRUD operations for dating profiles.  Because the primary key is the
 * same UUID as the user's account ID, this is effectively a one-to-one extension of
 * the User table.
 *
 * <h2>Type parameters</h2>
 * {@code JpaRepository<DatingProfile, UUID>} — the primary key type is
 * {@link java.util.UUID} matching the {@code DatingProfile.id} field.
 *
 * <h2>Why no custom methods?</h2>
 * The dating profiles feature is relatively simple — the controller uses the inherited
 * {@code findById}, {@code findAll}, and {@code save} methods exclusively.
 * Custom query methods would be added here if filtering (e.g. by age range, location,
 * or interests) were implemented in the future.
 */
package com.hustleup.social.repository;

import com.hustleup.social.model.DatingProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface DatingProfileRepository extends JpaRepository<DatingProfile, UUID> {
    // Inherits the following key methods from JpaRepository:
    //   findById(UUID id)    — load a user's profile by their UUID
    //   findAll()            — load all profiles (used by the browse/swipe screen)
    //   save(DatingProfile)  — upsert a profile (create if new, update if exists)
    //   existsById(UUID id)  — check if a user has set up a profile
    //   deleteById(UUID id)  — delete a profile (not currently exposed via API)
}
