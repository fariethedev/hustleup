package com.hustleup.marketplace.shipping;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="carrier_bindings") @Getter @Setter @NoArgsConstructor
public class CarrierBinding {
    @Id @Column(length=80) private String trackingNumber;
    @Column(nullable=false,unique=true,length=80) private String orderReference;
}
