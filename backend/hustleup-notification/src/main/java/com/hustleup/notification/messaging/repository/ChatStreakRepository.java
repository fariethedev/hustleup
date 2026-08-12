package com.hustleup.notification.messaging.repository;

import com.hustleup.notification.messaging.model.ChatStreak;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChatStreakRepository extends JpaRepository<ChatStreak, String> {

    /** Looks up the streak row for a pair. Callers must pass IDs already normalized (a < b). */
    Optional<ChatStreak> findByUserAIdAndUserBId(String userAId, String userBId);
}
