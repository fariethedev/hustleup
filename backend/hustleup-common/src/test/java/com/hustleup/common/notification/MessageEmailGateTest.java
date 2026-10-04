package com.hustleup.common.notification;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class MessageEmailGateTest {
    @Test void onlyFirstUnreadMessageClaimsEmailAndOpeningResetsGate() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID recipient=UUID.randomUUID(), sender=UUID.randomUUID();
        String insert="INSERT IGNORE INTO message_email_gates(recipient_id,sender_id) VALUES (?,?)";
        when(jdbc.update(insert, recipient.toString(), sender.toString())).thenReturn(1,0,1);
        MessageEmailGate gate=new MessageEmailGate(jdbc);
        assertTrue(gate.claim(recipient,sender)); assertFalse(gate.claim(recipient,sender));
        gate.opened(recipient,sender);
        verify(jdbc).update("DELETE FROM message_email_gates WHERE recipient_id=? AND sender_id=?",recipient.toString(),sender.toString());
        assertTrue(gate.claim(recipient,sender));
    }
}
