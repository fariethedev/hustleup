package com.hustleup.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DirectMessageRepository extends JpaRepository<DirectMessage, String> {

    @Query("SELECT m FROM DirectMessage m WHERE (m.senderId = :user1 AND m.receiverId = :user2) OR (m.senderId = :user2 AND m.receiverId = :user1) ORDER BY m.createdAt ASC")
    List<DirectMessage> findConversation(String user1, String user2);

    @Query("SELECT DISTINCT CASE WHEN m.senderId = :userId THEN m.receiverId ELSE m.senderId END FROM DirectMessage m WHERE m.senderId = :userId OR m.receiverId = :userId")
    List<String> findDistinctChatPartners(String userId);
}
