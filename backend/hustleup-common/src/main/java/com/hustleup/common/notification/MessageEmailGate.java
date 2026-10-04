package com.hustleup.common.notification;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.UUID;

@Service @RequiredArgsConstructor
public class MessageEmailGate {
    private final JdbcTemplate jdbc;
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claim(UUID recipient, UUID sender) {
        return jdbc.update("INSERT INTO message_email_gates(recipient_id,sender_id) VALUES (?,?) ON CONFLICT DO NOTHING", recipient, sender) == 1;
    }
    @Transactional
    public void opened(UUID recipient, UUID sender) {
        jdbc.update("DELETE FROM message_email_gates WHERE recipient_id=? AND sender_id=?", recipient, sender);
    }
}
