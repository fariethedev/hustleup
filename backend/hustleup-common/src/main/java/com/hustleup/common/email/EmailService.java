/**
 * Thin wrapper around the Resend Java SDK for sending transactional email
 * (verification, password reset, booking notifications).
 *
 * <p>Shared in hustleup-common so any service can send email without duplicating
 * the Resend client setup — currently used by hustleup-auth (account emails) and
 * hustleup-marketplace (booking/payout notifications).
 *
 * <p>If {@code app.resend.api-key} is blank (the default until a real key is
 * configured), {@link #send} logs the email instead of calling Resend, so the
 * rest of the app keeps working without a configured provider — callers should
 * still treat this as best-effort and never let a failed send block the calling
 * flow (see call sites for the try/catch pattern).
 */
package com.hustleup.common.email;

import com.resend.Resend;
import com.resend.services.emails.model.CreateEmailOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final Resend resend;
    private final String fromAddress;
    private final boolean configured;

    public EmailService(@Value("${app.resend.api-key:}") String apiKey,
                         @Value("${app.email.from:HustleUp <notifications@hustleup.app>}") String fromAddress) {
        this.configured = apiKey != null && !apiKey.isBlank();
        this.resend = configured ? new Resend(apiKey) : null;
        this.fromAddress = fromAddress;
    }

    /**
     * Sends an HTML email. Best-effort: logs and returns normally on failure rather
     * than throwing, so a broken email provider never blocks registration, booking
     * confirmation, etc. Callers that want to know whether it actually sent can still
     * wrap this in their own try/catch for logging purposes.
     */
    public void send(String to, String subject, String htmlBody) {
        if (!configured) {
            log.info("RESEND_API_KEY not set — skipping real send. Would have emailed {} subject=\"{}\"", to, subject);
            return;
        }
        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(to)
                    .subject(subject)
                    .html(htmlBody)
                    .build();
            resend.emails().send(params);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}
