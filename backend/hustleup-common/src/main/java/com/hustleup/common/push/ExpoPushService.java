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
        if (pushToken == null || pushToken.isBlank()) return;
        try {
            Map<String, Object> payload = Map.of(
                    "to", pushToken,
                    "title", title,
                    "body", body,
                    "sound", "default"
            );
            restTemplate.postForObject(EXPO_PUSH_URL, payload, String.class);
        } catch (Exception e) {
            log.warn("Expo push failed: {}", e.getMessage());
        }
    }
}
