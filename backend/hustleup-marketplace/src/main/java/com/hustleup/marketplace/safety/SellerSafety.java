package com.hustleup.marketplace.safety;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;
import java.util.UUID;
@Entity @Table(name="seller_safety") @Getter @Setter @NoArgsConstructor
public class SellerSafety {
    @Id @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name="seller_id", columnDefinition="VARCHAR(36)") private UUID sellerId;
    private boolean suspended;
    @Column(length=1000) private String reason;
    private boolean refundOpenOrders;
    private boolean bankPayoutsPaused;
    @Column(length=2000) private String lastError;
    private LocalDateTime suspendedAt;
}
