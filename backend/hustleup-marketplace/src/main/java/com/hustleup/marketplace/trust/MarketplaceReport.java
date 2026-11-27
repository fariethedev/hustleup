package com.hustleup.marketplace.trust;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user's report that a listing, shop or seller is fraudulent, counterfeit, prohibited or
 * misleading — the "notice" in the DSA's notice-and-action duty. Moderators work these from the
 * admin Trust &amp; Safety queue; every decision records its reason and the reporter is told the
 * outcome.
 */
@Entity
@Table(name = "marketplace_reports")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MarketplaceReport {
    public enum TargetType { LISTING, SHOP, SELLER }
    public enum Reason { COUNTERFEIT, SCAM, NOT_RECEIVED_PATTERN, PROHIBITED_ITEM, MISLEADING, OFF_PLATFORM_PAYMENT, OFFENSIVE, OTHER }
    public enum Status { OPEN, ACTIONED, DISMISSED }

    @Id @org.hibernate.annotations.UuidGenerator
    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(columnDefinition = "VARCHAR(36)")
    private UUID id;

    @Enumerated(EnumType.STRING) @Column(name = "target_type", nullable = false, length = 20)
    private TargetType targetType;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "target_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID targetId;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "seller_id", columnDefinition = "VARCHAR(36)")
    private UUID sellerId;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "reporter_id", nullable = false, columnDefinition = "VARCHAR(36)")
    private UUID reporterId;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40)
    private Reason reason;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.OPEN;

    @Column(name = "action_taken", length = 40)
    private String actionTaken;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "resolved_by", columnDefinition = "VARCHAR(36)")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
