
package com.hustleup.messaging;

import com.hustleup.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class ChatController {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatController(ChatMessageRepository chatMessageRepository, UserRepository userRepository,
                          SimpMessagingTemplate messagingTemplate) {
        this.chatMessageRepository = chatMessageRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/chat.send/{bookingId}")
    public void sendMessage(@DestinationVariable String bookingId, ChatMessageDto messageDto) {
        ChatMessage message = ChatMessage.builder()
                .bookingId(UUID.fromString(bookingId))
                .senderId(messageDto.getSenderId())
                .content(messageDto.getContent())
                .messageType(messageDto.getMessageType() != null ? messageDto.getMessageType() : "TEXT")
                .build();

        ChatMessage saved = chatMessageRepository.save(message);
        ChatMessageDto dto = ChatMessageDto.fromEntity(saved);
        userRepository.findById(saved.getSenderId()).ifPresent(u -> dto.setSenderName(u.getFullName()));

        messagingTemplate.convertAndSend("/topic/booking/" + bookingId, dto);
    }

    @GetMapping("/api/v1/messages/{bookingId}")
    public ResponseEntity<List<ChatMessageDto>> getHistory(@PathVariable UUID bookingId) {
        List<ChatMessageDto> messages = chatMessageRepository
                .findByBookingIdOrderByCreatedAtAsc(bookingId).stream()
                .map(msg -> {
                    ChatMessageDto dto = ChatMessageDto.fromEntity(msg);
                    userRepository.findById(msg.getSenderId()).ifPresent(u -> dto.setSenderName(u.getFullName()));
                    return dto;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(messages);
    }
}
