package com.hustleup.social;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface StoryRepository extends JpaRepository<Story, String> {
    List<Story> findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime now);
    List<Story> findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(String authorId, LocalDateTime now);
    void deleteByExpiresAtBefore(LocalDateTime now);
}
