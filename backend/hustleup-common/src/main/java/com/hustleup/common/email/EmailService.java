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
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
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

    /**
     * Amazon SES client, or null when SES is not switched on.
     *
     * <p>Preferred over SMTP when both are configured. SES reuses the AWS credentials the app
     * already holds for S3, so there is no second secret to generate or keep in step, and
     * delivery problems surface in one place rather than two.
     */
    private final SesClient sesClient;

    public EmailService(
            @org.springframework.beans.factory.annotation.Autowired(required = false) JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${app.email.from:HustleSpace <notifications@hustlespace.space>}") String from,
            @Value("${app.email.ses.enabled:false}") boolean sesEnabled,
            @Value("${app.email.ses.region:us-east-1}") String sesRegion) {

        this.mailSender = mailSender;

        // Built eagerly so a bad region fails at startup rather than on the first email a real
        // user is waiting for. The default credentials chain picks up AWS_ACCESS_KEY_ID /
        // AWS_SECRET_ACCESS_KEY — the same pair S3 already uses.
        SesClient ses = null;
        if (sesEnabled) {
            try {
                ses = SesClient.builder().region(Region.of(sesRegion)).build();
            } catch (Exception e) {
                log.error("SES is enabled but the client could not be built ({}): falling back to SMTP",
                        e.getMessage());
            }
        }
        this.sesClient = ses;
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

        if (sesClient != null) {
            log.info("EmailService: Amazon SES active in {}, sending as {} <{}>", sesRegion, fromName, fromAddress);
            // Worth saying plainly, because the failure it prevents is silent and total: SES
            // only accepts a From address that is a verified identity, and a brand-new account
            // is in the sandbox, where it will also only DELIVER to verified addresses. Both
            // rejections look like a working app that sends nothing.
            log.info("EmailService: SES requires {} to be a verified identity, and while the "
                    + "account is in the SES sandbox it can only deliver to verified addresses",
                    fromAddress);
        } else if (configured) {
            log.info("EmailService: SMTP transport active, sending as {} <{}>", fromName, fromAddress);
        } else {
            log.warn("EmailService: no mail transport configured — emails will be logged, not sent");
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
        if (sesClient != null) {
            sendViaSes(to, subject, htmlBody);
            return;
        }
        if (!configured) {
            log.info("No mail transport — skipping real send. Would have emailed {} subject=\"{}\"", to, subject);
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

    /** The SES path. Same best-effort contract as the SMTP one: it logs, it never throws. */
    private void sendViaSes(String to, String subject, String htmlBody) {
        try {
            sesClient.sendEmail(SendEmailRequest.builder()
                    // SES takes the display name in the same RFC 5322 form as a mail header.
                    .source(fromName + " <" + fromAddress + ">")
                    .destination(Destination.builder().toAddresses(to).build())
                    .message(Message.builder()
                            .subject(Content.builder().charset("UTF-8").data(subject).build())
                            .body(Body.builder()
                                    .html(Content.builder().charset("UTF-8").data(htmlBody).build())
                                    .build())
                            .build())
                    .build());
            log.debug("Sent email via SES to {} subject=\"{}\"", to, subject);
        } catch (Exception e) {
            // The two failures worth recognising here both look like this: an unverified From
            // identity, and a sandbox account emailing an unverified recipient. Neither is a
            // code fault, and neither should take down the flow that triggered the message.
            log.error("SES failed to send to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Whether email can actually leave this process.
     *
     * <p>Read by registration, which only enforces email verification when there is a working
     * transport: requiring people to click a link that was never sent would make signing up
     * impossible rather than secure.
     */
    public boolean isDeliverable() {
        return sesClient != null || configured;
    }
}
