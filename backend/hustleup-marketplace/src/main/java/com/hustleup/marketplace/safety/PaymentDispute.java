package com.hustleup.marketplace.safety;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="payment_disputes") @Getter @Setter @NoArgsConstructor
public class PaymentDispute {
    @Id @Column(length=100) private String id;
    @Column(length=100) private String paymentIntentId;
    @Column(length=80) private String stripeStatus;
    private boolean recovered;
    private boolean evidenceSubmitted;
    @Column(columnDefinition="TEXT") private String evidence;
    @Column(length=2000) private String lastError;
    private LocalDateTime updatedAt;
}
