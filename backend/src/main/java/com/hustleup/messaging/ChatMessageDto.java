package com.hustleup.messaging;

import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatMessageDto {
    private UUID id;
    private UUID bookingId;
    private UUID senderId;
    private String senderName;
    private String content;
    private String messageType;
    private LocalDateTime createdAt;

    public static ChatMessageDto fromEntity(ChatMessage msg) {
        return ChatMessageDto.builder()
                .id(msg.getId())
                .bookingId(msg.getBookingId())
                .senderId(msg.getSenderId())
                .content(msg.getContent())
                .messageType(msg.getMessageType())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
