package com.hustleup.marketplace.trust;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Who a seller legally is.
 *
 * <ul>
 *   <li><b>Trader status</b> (EU Omnibus / DSA): buyers must be told whether they are buying
 *       from a business — which owes them consumer rights such as the 14-day withdrawal — or a
 *       private person. A business must give its name, registration and contact details before
 *       selling (DSA Art. 30 trader traceability).</li>
 *   <li><b>DAC7</b>: once a seller passes the reporting threshold, the platform must report
 *       their identity (name, tax ID, date of birth, address) and earnings to the tax office.</li>
 *   <li><b>Standing</b>: strikes from upheld claims, and the payout bank fingerprint used to
 *       link a new account to one already suspended.</li>
 * </ul>
 */
@Entity
@Table(name = "seller_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SellerProfile {
    public enum SellerType { PRIVATE, BUSINESS }

    @Id @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "user_id", columnDefinition = "VARCHAR(36)")
    private UUID userId;

    @Enumerated(EnumType.STRING) @Column(name = "seller_type", nullable = false, length = 10)
    @Builder.Default
    private SellerType sellerType = SellerType.PRIVATE;

    @Column(name = "legal_name", length = 200) private String legalName;
    @Column(name = "business_name", length = 200) private String businessName;
    @Column(name = "tax_id", length = 40) private String taxId;
    @Column(name = "vat_number", length = 40) private String vatNumber;
    @Column(name = "registration_no", length = 60) private String registrationNo;
    @Column(name = "date_of_birth") private LocalDate dateOfBirth;
    @Column(name = "address_line1", length = 200) private String addressLine1;
    @Column(length = 100) private String city;
    @Column(name = "postal_code", length = 20) private String postalCode;
    @Column(length = 2) private String country;
    @Column(name = "contact_email", length = 200) private String contactEmail;
    @Column(name = "contact_phone", length = 40) private String contactPhone;

    @Builder.Default private int strikes = 0;

    @Column(name = "bank_fingerprint", length = 64) private String bankFingerprint;

    @JdbcTypeCode(SqlTypes.VARCHAR) @Column(name = "linked_to", columnDefinition = "VARCHAR(36)")
    private UUID linkedTo;

    @Column(name = "created_at") @Builder.Default private LocalDateTime createdAt = LocalDateTime.now();
    @Column(name = "updated_at") private LocalDateTime updatedAt;

    /** A business seller may not sell until these are filled in (DSA trader traceability). */
    public boolean traderDetailsComplete() {
        return sellerType != SellerType.BUSINESS || (notBlank(businessName) && notBlank(registrationNo)
                && notBlank(addressLine1) && notBlank(city) && notBlank(country) && notBlank(contactEmail));
    }

    /** The identity fields DAC7 reports for a seller over the threshold. */
    public boolean taxDetailsComplete() {
        return notBlank(legalName) && notBlank(taxId) && notBlank(addressLine1) && notBlank(city) && notBlank(country)
                && (sellerType == SellerType.BUSINESS || dateOfBirth != null);
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
