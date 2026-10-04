package com.hustleup.marketplace.booking.model;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
public record NegotiationRound(UUID offeredBy, BigDecimal price, LocalDateTime at) {}
