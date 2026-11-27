/**
 * Sends mobile push notifications via Expo's push API, which relays to FCM (Android) and
 * APNs (iOS) on your behalf — no need to touch the Firebase Admin SDK or manage service
 * account credentials in this backend.
 *
 * <p>No-op whenever a user has no registered {@code pushToken} (the default until the
 * mobile app calls {@code PATCH /api/v1/users/me/push-token} after the user grants
 * notification permission and Expo hands back a token) — the rest of the app, including
 * the existing in-app {@code Notification} rows, keeps working identically either way.
 *
 * <p>Sending an Android push additionally requires uploading FCM V1 credentials to your
 * Expo/EAS project once (see INTEGRATIONS.md) — that's an account-level setup step with
 * no corresponding backend env var, since Expo's push endpoint itself needs no API key
 * for the free tier.
 */
package com.hustleup.common.push;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class ExpoPushService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Best-effort: never throws, so a failed or unconfigured push never blocks the
     * in-app notification flow it accompanies.
     *
     * @param pushToken the recipient's Expo push token (e.g. {@code ExponentPushToken[xxxx]}),
     *                   or {@code null}/blank if the user hasn't registered a device
     */
    public void send(String pushToken, String title, String body) {
        send(pushToken, title, body, Map.of());
    }

    /**
     * Same, with a {@code data} payload the app reads when the push is tapped — a
     * {@code type} and {@code referenceId} let it open the matching screen (the chat, the
     * booking, the listing) instead of just launching the app.
     */
    public void send(String pushToken, String title, String body, Map<String, String> data) {
        if (pushToken == null || pushToken.isBlank()) return;
        if (!pushToken.startsWith("ExponentPushToken[") && !pushToken.startsWith("ExpoPushToken[")) {
            log.debug("Skipping push to a non-Expo token");
            return;
        }
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("to", pushToken);
            payload.put("title", truncate(title, 120));
            payload.put("body", truncate(body, 240));
            payload.put("sound", "default");
            payload.put("priority", "high");         // deliver promptly, also on Android Doze
            payload.put("channelId", "default");     // the channel the app creates at startup
            payload.put("data", data == null ? Map.of() : data);
            String response = restTemplate.postForObject(EXPO_PUSH_URL, payload, String.class);
            // Expo answers 200 even when a ticket failed (e.g. DeviceNotRegistered after an
            // uninstall); surface that in the logs rather than failing silently.
            if (response != null && response.contains("\"status\":\"error\"")) {
                log.warn("Expo push rejected: {}", truncate(response, 300));
            }
        } catch (Exception e) {
            log.warn("Expo push failed: {}", e.getMessage());
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
