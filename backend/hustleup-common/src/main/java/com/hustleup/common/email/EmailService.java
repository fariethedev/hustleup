/**
 * Sends transactional email (verification, password reset, booking notifications) over SMTP.
 *
 * <p>Shared in hustleup-common so any service can send email without duplicating transport
 * setup — currently used by hustleup-auth (account and publisher emails) and
 * hustleup-marketplace (booking notifications).
 *
 * <h2>Why SMTP</h2>
 * Mail for hustlespace.space is a hosted mailbox subscription, so the mailbox itself is the
 * sending path. Spring's {@link JavaMailSender} speaks plain SMTP, which every mailbox host
 * supports — and so does every transactional provider, should this ever move to one.
 *
 * <h2>Unconfigured = log, never fail</h2>
 * With no SMTP host set (the default in local development) {@link #send} logs what it would
 * have sent instead of connecting anywhere. That keeps registration, booking confirmation and
 * the rest working on a laptop with no mail credentials. Sending is best-effort in all cases:
 * a failure is logged and swallowed rather than thrown, because a bounced notification must
 * never roll back the action that triggered it.
 */
package com.hustleup.common.email;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class EmailService {

    /** Splits "Display Name <box@domain>" so the display name can be set separately. */
    private static final Pattern FROM_PATTERN = Pattern.compile("^\\s*(.*?)\\s*<\\s*(.+?)\\s*>\\s*$");

    /**
     * Null when no mail transport is configured. Spring Boot only creates a JavaMailSender
     * when spring.mail.host is present, so this is injected as optional rather than required —
     * a missing host is a normal local-development state, not a startup failure.
     */
    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String fromName;
    private final boolean configured;

    public EmailService(
            @org.springframework.beans.factory.annotation.Autowired(required = false) JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${app.email.from:HustleSpace <notifications@hustlespace.space>}") String from) {

        this.mailSender = mailSender;
        // Boot auto-configures a JavaMailSender whenever the spring.mail.host *property*
        // exists — and ours is declared as ${MAIL_HOST:}, so with no environment override it
        // exists as an empty string and a sender is built pointing at nowhere. Checking the
        // host itself is what actually distinguishes "configured" from "not configured";
        // without it every send would attempt a connection to "" and log a failure per email.
        this.configured = mailSender != null && smtpHost != null && !smtpHost.isBlank();

        Matcher m = FROM_PATTERN.matcher(from == null ? "" : from);
        if (m.matches()) {
            this.fromName = m.group(1).isBlank() ? "HustleSpace" : m.group(1);
            this.fromAddress = m.group(2);
        } else {
            // A bare address with no display name is valid too.
            this.fromName = "HustleSpace";
            this.fromAddress = (from == null || from.isBlank())
                    ? "notifications@hustlespace.space" : from.trim();
        }

        if (configured) {
            log.info("EmailService: SMTP transport active, sending as {} <{}>", fromName, fromAddress);
        } else {
            log.warn("EmailService: MAIL_HOST not set — emails will be logged, not sent");
        }
    }

    /**
     * Sends an HTML email.
     *
     * <p>Best-effort: logs and returns normally on failure rather than throwing, so a broken
     * mail provider never blocks the flow that triggered the message.
     *
     * @param to        recipient address
     * @param subject   subject line
     * @param htmlBody  HTML body; sent as text/html
     */
    public void send(String to, String subject, String htmlBody) {
        if (!configured) {
            log.info("SMTP not configured — skipping real send. Would have emailed {} subject=\"{}\"", to, subject);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            // multipart=false, explicit UTF-8 so non-ASCII subjects and Polish characters in
            // bodies survive; the default charset would mangle them.
            MimeMessageHelper helper =
                    new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress, fromName);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true); // true => HTML
            mailSender.send(message);
            log.debug("Sent email to {} subject=\"{}\"", to, subject);
        } catch (UnsupportedEncodingException e) {
            log.error("Invalid from-address encoding for {}: {}", fromAddress, e.getMessage());
        } catch (Exception e) {
            // Covers MailAuthenticationException, MailSendException, connection timeouts —
            // all of which are the provider's problem, not the caller's.
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }
}
