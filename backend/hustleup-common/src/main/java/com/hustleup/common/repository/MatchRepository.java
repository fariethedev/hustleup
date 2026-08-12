package com.hustleup.common.repository;

import com.hustleup.common.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface MatchRepository extends JpaRepository<Match, UUID> {

    /**
     * Looks up a match by its canonical (smaller-UUID-first) pair. Callers should sort the
     * two user IDs first via {@link Match.Pair#of}.
     */
    boolean existsByUserIdAAndUserIdB(UUID userIdA, UUID userIdB);

    /** Every match a user is part of, on either side of the pair — powers a future "Matches" list. */
    @Query("SELECT m FROM Match m WHERE m.userIdA = :userId OR m.userIdB = :userId")
    List<Match> findAllForUser(@Param("userId") UUID userId);
}
