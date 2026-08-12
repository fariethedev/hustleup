# HustleUp — Third-Party Integrations Guide

Step-by-step instructions for wiring external services into HustleUp: transactional email, Stripe, Google/Facebook login, Sentry, Crisp live chat, bot protection, Firebase push notifications, Algolia search, a CDN, maps/location ("how far is this seller"), and your legal pages (Terms & Conditions, Privacy Policy, Cookie Policy).

Each section assumes the current architecture:

| Piece | What it is |
|---|---|
| `hustleup-gateway` (`:8000`) | Spring Cloud Gateway — every client request enters here |
| `hustleup-auth` (`:8081`) | Register/login/JWT, user profiles |
| `hustleup-social` (`:8082`) | Feed, stories, follows, dating |
| `hustleup-marketplace` (`:8083`) | Listings, bookings, reviews, availability, Stripe Connect payouts |
| `hustleup-subscription` (`:8084`) | Premium subscriptions, Stripe Checkout |
| `hustleup-notification` (`:8085`) | Notifications, DMs, WebSocket chat |
| `hustleup-common` | Shared `User`/`Listing`-adjacent code, `CommonSecurityConfig`, `JwtTokenProvider`, `FileStorageService` |
| `frontend/` | React + Vite, axios client in `frontend/src/api/client.js` |
| `mobile/` | Expo/React Native app in `mobile/app/` |

> [!NOTE]
> All backend env vars go through each service's `application.yml` (`${ENV_VAR_NAME}` placeholders) and are set as real environment variables before launch — see `backend/.env.example` for the current list. All frontend env vars must be prefixed `VITE_` and read via `import.meta.env.VITE_...` (Vite only exposes prefixed vars to client code) — **none exist yet**, this guide introduces the first ones.

> [!WARNING]
> Every backend service validates JWTs independently via `JwtTokenProvider` (`backend/hustleup-common/.../security/JwtTokenProvider.java`), all reading the same `JWT_SECRET` env var. If you ever restart just one service with a different value for that (or any shared secret), it will silently reject every request from the others — always relaunch with the exact same `.env` values across all six services.

## Suggested rollout order

Do these roughly in this order — legal and monitoring are cheap and should exist before you have real users; payments should be locked down before money moves; growth features (search, CDN, push) matter most once you have traffic.

1. [Terms & Conditions / Privacy Policy / Cookie Policy](#-terms--conditions-privacy-policy--cookie-policy)
2. [Sentry](#-sentry-error-monitoring) (so you see errors from day one)
3. [Transactional email](#-transactional-email)
4. [Finish Stripe](#-stripe-payments-finishing-what-you-have) (already scaffolded — this closes the gaps)
5. [Bot protection](#-bot-protection)
6. [Google](#-google-sign-in) / [Facebook](#-facebook-login) sign-in
7. [Maps & "distance from seller"](#-maps--distance-from-seller)
8. [CDN for media](#-cdn-for-media-delivery)
9. [Algolia search](#-algolia-search)
10. [Crisp live chat](#-crisp-live-chat--support)
11. [Firebase Cloud Messaging](#-firebase-cloud-messaging-push-notifications)

---

## 📜 Terms & Conditions, Privacy Policy & Cookie Policy

Not a code integration, but do this first — HustleUp already collects PII (email, phone, address, ID verification flags) and moves money via Stripe, and your primary market is Poland/EU, which means **GDPR applies**, not just "nice to have" boilerplate.

- [ ] **Draft the documents.** Don't hand-write GDPR clauses from scratch. Use a generator built for this — [Termly](https://termly.io), [Iubenda](https://www.iubenda.com), or [GetTerms](https://getterms.io) all produce a Terms of Service, Privacy Policy, and Cookie Policy from a questionnaire, and Iubenda/Termly specifically support GDPR + Poland's UODO requirements.
- [ ] Answer their questionnaire honestly about what you actually do: collect email/phone/address, process payments via Stripe (name them as a sub-processor), store uploaded photos (S3), use cookies for login sessions, etc.
- [ ] Get a **cookie consent banner** from the same provider (Termly/Iubenda both offer a JS snippet) — required before setting any non-essential cookie (analytics, Crisp, Algolia's usage tracking, etc.) under EU law.
- [ ] Host the generated pages. Simplest: add two routes to the React app.
  ```jsx
  // frontend/src/App.jsx — add alongside existing public routes
  <Route path="/terms" element={<Terms />} />
  <Route path="/privacy" element={<Privacy />} />
  ```
  Create `frontend/src/pages/Terms.jsx` and `Privacy.jsx` that render the generated HTML/markdown (most generators give you an embeddable script tag or static HTML you can paste in).
- [ ] Link them in `frontend/src/components/Footer.jsx` and on the `Register.jsx` page ("By signing up you agree to our [Terms] and [Privacy Policy]").
- [ ] **Track acceptance.** Add a checkbox to registration that must be checked, and record it:
  ```java
  // backend/hustleup-common/.../model/User.java
  @Column(name = "terms_accepted_at")
  private LocalDateTime termsAcceptedAt;
  ```
  Set it in `AuthController.register()` (`backend/hustleup-auth/.../controller/AuthController.java`) when the request includes `termsAccepted: true`; reject the request with 400 if it's missing/false.
- [ ] Re-prompt existing users if you materially change the terms later (bump a `termsVersion` field and compare).

---

## 🐛 Sentry (error monitoring)

Covers all six backend services, the React frontend, and the Expo app from one dashboard.

### 1. Account & project setup
- [ ] Sign up at [sentry.io](https://sentry.io) (free tier: 5k errors/month — plenty to start).
- [ ] Create **one Sentry project per surface** you want separated in the dashboard — minimum: `hustleup-backend` (Java), `hustleup-frontend` (React), `hustleup-mobile` (React Native). You'll get a DSN (a URL, looks like `https://xxxx@o123.ingest.sentry.io/456`) per project.

### 2. Backend (all six services)
- [ ] Add the dependency to the parent POM's `<dependencyManagement>` (`backend/pom.xml`, next to the existing `stripe.version` pin) so every service uses the same version:
  ```xml
  <dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-spring-boot-starter-jakarta</artifactId>
    <version>7.14.0</version>
  </dependency>
  ```
- [ ] Add `sentry-spring-boot-starter-jakarta` (no version needed, inherited) to each of the 6 services' `pom.xml` — same pattern as how `stripe-java` was added to `hustleup-marketplace/pom.xml`.
- [ ] Add to each service's `application.yml`:
  ```yaml
  sentry:
    dsn: ${SENTRY_DSN:}
    environment: ${SENTRY_ENV:development}
    traces-sample-rate: 0.2
  ```
- [ ] Add `SENTRY_DSN` to `backend/.env.example` and your real `.env`, and to the env-var block in your launch script (`start-services.ps1` / however you start the services) alongside `JWT_SECRET`, `MYSQL_PASSWORD`, etc.
- [ ] `mvn clean package` each touched service and restart — Sentry auto-instruments Spring MVC exceptions with zero extra code. To send something manually:
  ```java
  import io.sentry.Sentry;
  // inside a catch block
  Sentry.captureException(e);
  ```

### 3. Frontend (React)
- [ ] `npm install @sentry/react --prefix frontend`
- [ ] In `frontend/src/main.jsx`, before rendering the app:
  ```js
  import * as Sentry from '@sentry/react';

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
  });
  ```
- [ ] Wrap the root in `<Sentry.ErrorBoundary fallback={<ErrorFallback />}>` — you already have `frontend/src/components/ErrorBoundary.jsx`; either replace it or nest Sentry's boundary inside yours so both the UI fallback and the Sentry report fire.
- [ ] Create `frontend/.env` (gitignored — add it to `.gitignore` if not already) with:
  ```
  VITE_SENTRY_DSN=https://xxxx@o123.ingest.sentry.io/456
  ```

### 4. Mobile (Expo)
- [ ] `npx expo install @sentry/react-native --prefix mobile`
- [ ] `npx @sentry/wizard@latest -i reactNative` (run from `mobile/`) — this patches `app.json`/`metro.config.js` automatically for source-map upload.
- [ ] Init in `mobile/app/_layout.js`:
  ```js
  import * as Sentry from '@sentry/react-native';
  Sentry.init({ dsn: 'https://xxxx@o123.ingest.sentry.io/789' });
  ```

### 5. Verify
- [ ] Throw a test error from each surface (a temporary `throw new Error('sentry test')` in a button handler) and confirm it lands in the right Sentry project, then delete the test code.

---

## 📧 Transactional Email

There is currently **no email-sending code anywhere in the backend** — no verification emails, no password-reset emails, no receipts. This is a from-scratch build.

### 1. Pick a provider
[Resend](https://resend.com) is the easiest to integrate with Spring Boot and has a generous free tier (3,000 emails/month, 1 domain). SendGrid or Postmark are fine alternatives if you prefer.

- [ ] Sign up at resend.com, verify a sending domain (add the DNS records they give you — SPF/DKIM — to your domain registrar), and generate an API key.

### 2. Add a shared email module
- [ ] Add to `backend/hustleup-common/pom.xml`:
  ```xml
  <dependency>
    <groupId>com.resend</groupId>
    <artifactId>resend-java</artifactId>
    <version>3.1.0</version>
  </dependency>
  ```
- [ ] Create `backend/hustleup-common/src/main/java/com/hustleup/common/email/EmailService.java`:
  ```java
  @Service
  public class EmailService {
      private final Resend resend;
      private final String fromAddress;

      public EmailService(@Value("${app.resend.api-key}") String apiKey,
                           @Value("${app.email.from}") String fromAddress) {
          this.resend = new Resend(apiKey);
          this.fromAddress = fromAddress;
      }

      public void send(String to, String subject, String htmlBody) {
          CreateEmailOptions params = CreateEmailOptions.builder()
                  .from(fromAddress).to(to).subject(subject).html(htmlBody).build();
          try {
              resend.emails().send(params);
          } catch (ResendException e) {
              log.error("Failed to send email to {}", to, e);
          }
      }
  }
  ```
- [ ] Add to `application.yml` for `hustleup-auth` (verification/reset emails) and `hustleup-notification` (order/booking emails):
  ```yaml
  app:
    resend:
      api-key: ${RESEND_API_KEY}
    email:
      from: HustleUp <notifications@yourdomain.com>
  ```
- [ ] Add `RESEND_API_KEY` to `backend/.env.example`.

### 3. Wire it into flows that need it
- [ ] **Verification email** — in `AuthController.register()` (`backend/hustleup-auth/.../controller/AuthController.java`), after saving the user, generate a random token, store it (new `EmailVerificationToken` entity, same pattern as the existing `RefreshToken`), and call `emailService.send(user.getEmail(), "Verify your HustleUp account", buildVerifyLink(token))`. Add `GET /api/v1/auth/verify?token=...` that flips `User.emailVerified` to `true`. Use `FRONTEND_URL` (already in `.env.example`) to build the link.
- [ ] **Password reset** — same token pattern, new `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` endpoints (both need adding to `CommonSecurityConfig`'s `/api/v1/auth/**` permitAll, which already covers the whole prefix — no change needed there).
- [ ] **Booking/order notifications** — call `emailService.send(...)` from `BookingService` (`backend/hustleup-marketplace/.../booking/service/BookingService.java`) alongside the existing in-app notification calls, for booking confirmed/cancelled/completed events.
- [ ] **Payout confirmations** — same idea in `StripeConnectService` after a successful `transferToSeller`.

### 4. Test
- [ ] Register a throwaway account and confirm the verification email actually arrives (check spam folder first time).
- [ ] Resend's dashboard shows delivery/bounce status per email — check it after each test send.

---

## 💳 Stripe Payments (finishing what you have)

Stripe Connect payouts (`hustleup-marketplace/.../payments/`) and subscription checkout (`hustleup-subscription/.../StripeService.java`) are **already built** and running on placeholder test keys (`sk_test_placeholder`). This section is about going live, not starting from scratch.

- [ ] Create a real [Stripe account](https://dashboard.stripe.com/register), complete business verification (needed before you can accept live payments or pay out via Connect).
- [ ] In the Stripe Dashboard, grab your **test** keys first (`sk_test_...`) — don't jump to live keys until you've tested the full flow.
- [ ] Replace the env vars everywhere they're currently set to placeholders:
  | Var | Where used |
  |---|---|
  | `STRIPE_SECRET_KEY` | `hustleup-subscription`, `hustleup-marketplace` |
  | `STRIPE_WEBHOOK_SECRET` | `hustleup-subscription` (subscription checkout webhook) |
  | `STRIPE_CONNECT_WEBHOOK_SECRET` | `hustleup-marketplace` (Connect payout webhook) |
- [ ] **Register the webhooks** in the Stripe Dashboard → Developers → Webhooks:
  - Endpoint `https://yourdomain.com/api/payments/webhook` → events `checkout.session.completed` (subscription flow, handled in `StripeController`).
  - Endpoint `https://yourdomain.com/api/v1/payouts/webhook` → events `account.updated`, `checkout.session.completed` (Connect flow, handled in `PayoutController`).
  - Copy the **signing secret** Stripe shows you for each into the two webhook-secret env vars above (they'll differ from your local test values).
- [ ] Locally, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks instead of registering a public URL: `stripe listen --forward-to localhost:8000/api/payments/webhook` — it prints a `whsec_...` to use as your local `STRIPE_WEBHOOK_SECRET`.
- [ ] Test the full loop with [Stripe's test cards](https://stripe.com/docs/testing) (`4242 4242 4242 4242`, any future expiry/CVC): buyer checkout → booking `BOOKED` → seller connects payouts (`Dashboard.jsx` Payouts tab) → mark booking `COMPLETED` → confirm the `Transfer` shows in Stripe's Connect dashboard.
- [ ] Set `app.stripe.platform-fee-percent` (`hustleup-marketplace/application.yml`, default `8`) to whatever cut HustleUp actually takes.
- [ ] Only once test mode is fully verified: swap in live keys (`sk_live_...`) and re-register the webhooks against the live endpoint. Stripe keeps test/live data completely separate, so nothing from testing carries over.

> [!WARNING]
> Never commit real Stripe keys. They only ever belong in environment variables / your deployment platform's secrets manager.

---

## 🔑 Google Sign-In

The current auth system (`AuthController` + `JwtTokenProvider`, both in `backend/hustleup-auth` / `backend/hustleup-common`) is email/password only. The cleanest way to add Google is: verify Google's ID token server-side, find-or-create a `User`, then issue the **same** JWT access/refresh tokens the app already uses everywhere — no changes needed to how the rest of the app checks auth.

### 1. Google Cloud setup
- [ ] Create a project at [console.cloud.google.com](https://console.cloud.google.com).
- [ ] Configure the OAuth consent screen (External, add your app name/logo, scopes: `email`, `profile`).
- [ ] Create an **OAuth Client ID** (Web application type). Add authorized origins: `http://localhost:5173` (dev) and your prod domain. Add authorized redirect URIs if using redirect-based flow (not needed for the popup/One Tap flow below).
- [ ] You get a **Client ID** (safe to expose to the frontend) and **Client Secret** (backend only, only needed if you verify via Google's OAuth token exchange rather than ID-token verification — the approach below doesn't need it).

### 2. Frontend
- [ ] `npm install @react-oauth/google --prefix frontend`
- [ ] Add `VITE_GOOGLE_CLIENT_ID=<your client id>` to `frontend/.env`.
- [ ] Wrap the app in `frontend/src/main.jsx`:
  ```jsx
  import { GoogleOAuthProvider } from '@react-oauth/google';
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
  ```
- [ ] On `Login.jsx` / `Register.jsx` (both already have a "Google" button rendered but not wired — see `socialProviders` array in `Login.jsx`), replace the plain `<button>` with:
  ```jsx
  import { useGoogleLogin } from '@react-oauth/google';

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const res = await authApi.googleLogin(tokenResponse.access_token);
      // same handling as loginUser.fulfilled — store tokens, navigate
    },
  });
  ```
- [ ] Add to `frontend/src/api/client.js`, inside `authApi`:
  ```js
  googleLogin: (accessToken) => api.post('/auth/oauth/google', { accessToken }),
  ```

### 3. Backend
- [ ] Add to `backend/hustleup-auth/pom.xml`:
  ```xml
  <dependency>
    <groupId>com.google.api-client</groupId>
    <artifactId>google-api-client</artifactId>
    <version>2.7.0</version>
  </dependency>
  ```
- [ ] Add a new endpoint in `AuthController`: `POST /api/v1/auth/oauth/google` — already covered by the existing `/api/v1/auth/**` permitAll rule in `CommonSecurityConfig`, no security change needed.
- [ ] Verify the token against Google, then reuse the exact same user-creation + `buildAuthResponse(...)` helper the password-based register flow already uses:
  ```java
  @PostMapping("/oauth/google")
  public ResponseEntity<AuthResponse> googleLogin(@RequestBody Map<String, String> body) {
      GoogleIdToken.Payload payload = googleTokenVerifier.verify(body.get("idToken"));
      String email = payload.getEmail();
      User user = userRepository.findByEmail(email).orElseGet(() -> {
          User u = User.builder()
              .email(email).fullName((String) payload.get("name"))
              .role(Role.BUYER) // default; let them switch to SELLER via Onboarding
              .password(passwordEncoder.encode(UUID.randomUUID().toString())) // unusable random password
              .emailVerified(true) // Google already verified it
              .build();
          return userRepository.save(u);
      });
      return ResponseEntity.ok(buildAuthResponse(user));
  }
  ```
- [ ] Note: the `User` entity requires a `password` field (NOT NULL) — OAuth users get a random, never-used password so they can't accidentally log in with the password flow using a guessed value. If a user later wants to *also* set a real password (to log in without Google), add a "Set password" flow in `Profile.jsx`'s edit modal.

### 4. Test
- [ ] Sign up as a brand-new Google account through the flow, confirm a `User` row is created with `emailVerified = true` and no usable password.
- [ ] Sign in again with the same Google account, confirm it logs into the *same* user (no duplicate).

---

## 🔵 Facebook Login

Same pattern as Google — verify server-side, reuse the existing JWT issuance.

### 1. Facebook Developer setup
- [ ] Create an app at [developers.facebook.com](https://developers.facebook.com/apps).
- [ ] Add the **Facebook Login** product, set Valid OAuth Redirect URIs to your domain(s).
- [ ] Under App Settings → Basic, get the **App ID** (public) and **App Secret** (backend only).
- [ ] Submit for App Review before going live if you need more than `public_profile`/`email` (those two are approved by default for any app).

### 2. Frontend
- [ ] Load the Facebook SDK (add to `frontend/index.html` `<head>`, or use `react-facebook-login` / `@greatsumini/react-facebook-login` npm package for a React-friendly wrapper — recommended to avoid manual SDK-script juggling):
  ```
  npm install @greatsumini/react-facebook-login --prefix frontend
  ```
- [ ] Add `VITE_FACEBOOK_APP_ID=<your app id>` to `frontend/.env`.
- [ ] Wire the existing "Facebook" button in `Login.jsx`'s `socialProviders` the same way as Google — on success, POST the returned access token to a new endpoint and handle the response identically to `loginUser.fulfilled`.
- [ ] Add to `authApi` in `client.js`: `facebookLogin: (accessToken) => api.post('/auth/oauth/facebook', { accessToken }),`

### 3. Backend
- [ ] No SDK dependency needed — verify by calling Facebook's Graph API directly with the access token the frontend sends:
  ```java
  @PostMapping("/oauth/facebook")
  public ResponseEntity<AuthResponse> facebookLogin(@RequestBody Map<String, String> body) {
      String accessToken = body.get("accessToken");
      // Verify + fetch profile in one call
      RestTemplate rt = new RestTemplate();
      Map<String, Object> profile = rt.getForObject(
          "https://graph.facebook.com/me?fields=id,name,email&access_token=" + accessToken,
          Map.class);
      String email = (String) profile.get("email");
      if (email == null) {
          return ResponseEntity.badRequest().body(/* Facebook accounts without an email can't register this way */);
      }
      // same find-or-create + buildAuthResponse as the Google flow
  }
  ```
- [ ] Handle the case where the Facebook account has no email attached (some do) — either reject with a clear error asking them to use email signup, or prompt for an email on your side before creating the account.

### 4. Test
- [ ] Same as Google: new account creates a user, repeat login reuses it.

---

## 🛡️ Bot Protection

[Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) over reCAPTCHA — it's free with no request cap, doesn't show annoying puzzles to real users, and is a drop-in widget.

### 1. Setup
- [ ] Add a site at [dash.cloudflare.com](https://dash.cloudflare.com) → Turnstile. Get a **Site Key** (public) and **Secret Key** (backend only).

### 2. Frontend — add to Register.jsx (and optionally Login.jsx if you see credential-stuffing attempts)
- [ ] `npm install @marsidev/react-turnstile --prefix frontend`
- [ ] Add `VITE_TURNSTILE_SITE_KEY=<site key>` to `frontend/.env`.
  ```jsx
  import { Turnstile } from '@marsidev/react-turnstile';
  const [captchaToken, setCaptchaToken] = useState('');
  // ...in the form:
  <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} />
  ```
- [ ] Include `captchaToken` in the register request body; disable the submit button until it's set.

### 3. Backend — verify before creating the account
- [ ] In `AuthController.register()`, before building the `User`:
  ```java
  boolean valid = turnstileService.verify(request.getCaptchaToken());
  if (!valid) {
      return ResponseEntity.badRequest().body(Map.of("error", "Captcha verification failed"));
  }
  ```
- [ ] `TurnstileService` just POSTs to Cloudflare's siteverify endpoint:
  ```java
  @Service
  public class TurnstileService {
      @Value("${app.turnstile.secret-key}") private String secretKey;
      public boolean verify(String token) {
          RestTemplate rt = new RestTemplate();
          var body = Map.of("secret", secretKey, "response", token);
          var resp = rt.postForObject("https://challenges.cloudflare.com/turnstile/v0/siteverify", body, Map.class);
          return Boolean.TRUE.equals(resp.get("success"));
      }
  }
  ```
- [ ] Add `TURNSTILE_SECRET_KEY` to `backend/.env.example` and `hustleup-auth`'s `application.yml`.

### 4. Test
- [ ] Confirm registration fails cleanly with a missing/invalid token (e.g. by tampering with the request in devtools) and succeeds normally through the real widget.

---

## 📍 Maps & "distance from seller"

No location data exists today — `User.city`/`addressLine1` and `Listing.locationCity` are free-text strings only, no coordinates anywhere. This is a from-scratch feature: geocode sellers' addresses once, then compute distance client-side from the buyer's live location.

### 1. Add coordinates to the data model
- [ ] Add to `User` (`backend/hustleup-common/.../model/User.java`):
  ```java
  private Double latitude;
  private Double longitude;
  ```
- [ ] Add a Flyway/manual migration (or let Hibernate `ddl-auto` handle it in dev) for `latitude DOUBLE`, `longitude DOUBLE` on the `users` table.

### 2. Geocode addresses (turn "Warszawa" into coordinates)
- [ ] Get a [Google Maps Platform](https://console.cloud.google.com/google/maps-apis) API key, enable the **Geocoding API** and **Maps JavaScript API**. Restrict the key by HTTP referrer (frontend) and by IP (backend) separately — you'll want two keys, one restricted for browser use, one for server use.
- [ ] Add a `GeocodingService` in `hustleup-common` that calls `https://maps.googleapis.com/maps/api/geocode/json?address={city},Poland&key={GOOGLE_MAPS_SERVER_KEY}` and returns `lat`/`lng` from the first result.
- [ ] Call it whenever a seller sets/changes their `city`/`addressLine1` — in `UserController.updateProfile()` (`backend/hustleup-auth/.../controller/UserController.java`), after saving the profile fields, geocode and store `latitude`/`longitude`.
- [ ] Backfill existing sellers with a one-off script/endpoint that geocodes everyone missing coordinates.

### 3. Get the buyer's live location (frontend)
- [ ] Use the browser's built-in Geolocation API — no SDK needed:
  ```js
  navigator.geolocation.getCurrentPosition(
    (pos) => setBuyerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => { /* user denied — fall back to no distance shown */ },
  );
  ```
- [ ] Ask for permission contextually (e.g. a "Show distance to sellers" toggle on `Explore.jsx`/`ShopDetail.jsx`), not on page load — browsers throttle/block permission prompts that fire immediately, and it reads as spammy.

### 4. Compute distance — no API call needed for the number itself
- [ ] Add a small Haversine helper in `frontend/src/utils/`:
  ```js
  export function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  ```
- [ ] Have `usersApi.getProfile`/listing responses include `latitude`/`longitude` (add to `UserDto`), then show `distanceKm(buyerLocation.lat, buyerLocation.lng, seller.latitude, seller.longitude).toFixed(1) + ' km away'` on `ShopDetail.jsx`, `ListingDetail.jsx`, and shop cards on `Explore.jsx`.

### 5. Optional: show an actual map
- [ ] `npm install @vis.gl/react-google-maps --prefix frontend` and `VITE_GOOGLE_MAPS_BROWSER_KEY` in `frontend/.env` if you want a visual map (e.g. on `ShopDetail.jsx`) rather than just a distance number. [Mapbox GL JS](https://www.mapbox.com/) is a solid alternative with a more generous free tier if Google's pricing is a concern at scale.
- [ ] Never show a seller's exact address on a map to buyers — only an approximate area (jitter the coordinates slightly, or just show city-level) unless the seller explicitly opts into precise location sharing. This matters both for safety and GDPR (precise geolocation is sensitive data).

### 6. Test
- [ ] Set two test seller accounts with known cities, confirm the geocoded coordinates are roughly right (check against Google Maps directly), and confirm the distance shown from a spoofed buyer location (devtools → Sensors → override geolocation) matches a manual calculation.

---

## 🌐 CDN for media delivery

`FileStorageService` (`backend/hustleup-common/.../storage/FileStorageService.java`) already supports S3 (dual-mode: S3 if `AWS_*` env vars are set, local disk otherwise) — this section adds CloudFront in front of the S3 bucket you already have.

- [ ] In AWS Console → CloudFront, create a distribution with your existing `AWS_S3_BUCKET` as the origin.
- [ ] Since listing/profile photos aren't sensitive, the simplest setup is: enable **Origin Access Control (OAC)** so the bucket stays private to everything except CloudFront, and let CloudFront serve publicly (no signed URLs needed) — much simpler than juggling presigned-URL expiry on top of a CDN.
- [ ] Note your distribution's domain (`d111111abcdef8.cloudfront.net`, or map a custom subdomain like `cdn.yourdomain.com` via Route 53/your DNS + an ACM certificate).
- [ ] Update `FileStorageService.uploadToS3()` to build the return URL from the CDN domain instead of the raw S3 URL:
  ```java
  // was: return "https://" + bucket + ".s3." + region + ".amazonaws.com/uploads/" + key;
  return "https://" + cdnDomain + "/uploads/" + key;
  ```
- [ ] Since the bucket is now public-via-CDN, `presign()`/`refreshUrl()` become unnecessary for new uploads — they can just return the stable CDN URL directly (no more 7-day expiry to manage). Existing already-presigned URLs in the database will keep working until they expire; a backfill script can re-point old rows to the CDN form.
- [ ] Add `CDN_DOMAIN` to `backend/.env.example` and `hustleup-common`'s config.
- [ ] Set a long cache TTL (these are immutable UUID-named files — cache forever, e.g. `Cache-Control: max-age=31536000, immutable`) via a CloudFront response headers policy.

### Test
- [ ] Upload a new avatar, confirm the URL returned is the CDN domain and loads correctly; confirm a second load is faster (CloudFront cache hit — check the `X-Cache` response header, should read `Hit from cloudfront` after the first request).

---

## 🔍 Algolia Search

Powers instant, typo-tolerant search over listings — a real upgrade over the current `GlobalSearch` component's likely simple DB query.

### 1. Setup
- [ ] Create an app at [algolia.com](https://www.algolia.com) (free tier: 10k searches/month, 10k records — fine to start). Get your **Application ID**, **Admin API Key** (backend, indexing), and **Search-Only API Key** (frontend, safe to expose).

### 2. Backend — keep the index in sync with listings
- [ ] Add to `backend/hustleup-marketplace/pom.xml`:
  ```xml
  <dependency>
    <groupId>com.algolia</groupId>
    <artifactId>algoliasearch-core</artifactId>
    <version>4.16.1</version>
  </dependency>
  ```
- [ ] Create `AlgoliaIndexService` in the marketplace service; call it from `ListingService.create()`/`.update()`/`.delete()` (`backend/hustleup-marketplace/.../listing/service/ListingService.java`) so every write to a listing pushes/removes it from the `listings` Algolia index (title, description, price, city, listingType, sellerName as searchable attributes).
- [ ] Add `ALGOLIA_APP_ID` and `ALGOLIA_ADMIN_KEY` to `backend/.env.example` and marketplace's config.
- [ ] Write a one-off backfill job/endpoint to index all currently-existing listings once, since new writes only cover things going forward.

### 3. Frontend
- [ ] `npm install algoliasearch --prefix frontend`
- [ ] Add `VITE_ALGOLIA_APP_ID` and `VITE_ALGOLIA_SEARCH_KEY` (the **search-only** key, never the admin key) to `frontend/.env`.
- [ ] In `frontend/src/components/GlobalSearch.jsx`, replace the current search call with an Algolia client query:
  ```js
  import algoliasearch from 'algoliasearch/lite';
  const client = algoliasearch(import.meta.env.VITE_ALGOLIA_APP_ID, import.meta.env.VITE_ALGOLIA_SEARCH_KEY);
  const index = client.initIndex('listings');
  const { hits } = await index.search(query);
  ```

### 4. Test
- [ ] Create a listing, confirm it's searchable (with a typo!) within a couple seconds; delete it, confirm it disappears from search results.

---

## 💬 Crisp (live chat & support)

Simplest integration in this whole guide — a single script tag, no backend changes required for the basic widget.

- [ ] Sign up at [crisp.chat](https://crisp.chat), create a website, grab your **Website ID** from Settings → Setup Instructions.
- [ ] Add `VITE_CRISP_WEBSITE_ID=<your id>` to `frontend/.env`.
- [ ] In `frontend/src/main.jsx` (or a small `CrispChat.jsx` component mounted once in `App.jsx`):
  ```js
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID;
  (function() {
    const d = document, s = d.createElement('script');
    s.src = 'https://client.crisp.chat/l.js'; s.async = 1;
    d.getElementsByTagName('head')[0].appendChild(s);
  })();
  ```
- [ ] Identify logged-in users so agents see who they're talking to — after login (in `authSlice.js`'s `loginUser.fulfilled` handler, or wherever the user object becomes available):
  ```js
  window.$crisp.push(['set', 'user:email', [user.email]]);
  window.$crisp.push(['set', 'user:nickname', [user.fullName]]);
  ```
- [ ] Optional: set up **Crisp's chatbot** (their built-in "Crisp Bot" / MagicReply feature under Settings → Chatbot) to auto-answer common questions (refund policy, how payouts work, etc.) before escalating to a human — feed it your Terms/FAQ content once those exist.
- [ ] Hide the widget on pages where it'd overlap your own UI chrome (e.g. `StoryViewer`'s full-screen modal) by toggling `window.$crisp.push(['do', 'chat:hide'])` / `['do', 'chat:show']` on route change if needed.

### Test
- [ ] Send a message as a logged-in test user from the widget, confirm it shows your test account's email/name in the Crisp inbox, not "Anonymous".

---

## 🔔 Firebase Cloud Messaging (push notifications)

Mobile only (`mobile/`) — there's no push infrastructure at all yet, and `mobile/app.json` doesn't even have `ios.bundleIdentifier`/`android.package` set, which you need before registering with Firebase/Apple.

### 1. Prerequisites — fix `mobile/app.json` first
- [ ] Add real bundle identifiers (required by both stores regardless of push):
  ```json
  {
    "expo": {
      "ios": { "bundleIdentifier": "com.hustleup.app" },
      "android": { "package": "com.hustleup.app" }
    }
  }
  ```

### 2. Firebase project
- [ ] Create a project at [console.firebase.google.com](https://console.firebase.google.com).
- [ ] Add an Android app with the exact `package` from `app.json`; download `google-services.json` into `mobile/`.
- [ ] Add an iOS app with the exact `bundleIdentifier`; download `GoogleService-Info.plist` into `mobile/`. For iOS you additionally need an **APNs Auth Key** from your Apple Developer account, uploaded into Firebase under Project Settings → Cloud Messaging.

### 3. Expo setup
- [ ] `npx expo install expo-notifications expo-device --prefix mobile`
- [ ] Add to `mobile/app.json`:
  ```json
  {
    "expo": {
      "android": { "googleServicesFile": "./google-services.json" },
      "ios": { "googleServicesFile": "./GoogleService-Info.plist" },
      "plugins": ["expo-router", "expo-splash-screen",
        ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#CDFF00" }]
      ]
    }
  }
  ```
- [ ] Because this needs native config files, you're now on an **EAS Build** (not plain `expo start` in Expo Go) for push to actually work — `npx eas build --profile development` and install that dev build on a real device to test (push doesn't work in the iOS Simulator, needs a real device or Android emulator with Play Services).

### 4. Register device tokens
- [ ] In `mobile/app/(tabs)/index.js` (or a shared init spot in `_layout.js`), on login:
  ```js
  import * as Notifications from 'expo-notifications';
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
    await usersApi.registerPushToken(pushToken); // new endpoint, see below
  }
  ```
- [ ] Backend: add a `push_token` column to `User`, a `PATCH /api/v1/users/me/push-token` endpoint in `UserController`, and send pushes via [Expo's push API](https://docs.expo.dev/push-notifications/sending-notifications/) (simplest — Expo relays to FCM/APNs for you, no need to touch the Firebase Admin SDK directly) from `NotificationService` (`backend/hustleup-notification`) whenever it creates a notification, alongside the existing in-app one.

### 5. Test
- [ ] Trigger a notification (e.g. someone likes your listing) with the app backgrounded, confirm a real push arrives on a physical device.

---

## Rough cost summary (student-marketplace scale, a few thousand users)

| Service | Free tier covers | Cost once you outgrow it |
|---|---|---|
| Sentry | 5k errors/mo | ~$26/mo |
| Resend (email) | 3k emails/mo | ~$20/mo for 50k |
| Stripe | No monthly fee | 1.5%+€0.25 per EU card txn (Connect adds a small % on transfers) |
| Google/Facebook login | Free, unlimited | Free |
| Cloudflare Turnstile | Free, unlimited | Free |
| Google Maps Platform | $200/mo credit | Pay-per-request after — watch Geocoding usage, cache results |
| Algolia | 10k searches + 10k records/mo | ~$50/mo |
| Crisp | Free (1 seat, basic) | ~$25/mo/seat for team features |
| Firebase Cloud Messaging | Free, unlimited | Free |
| CloudFront (CDN) | 1TB/mo (first 12 months) | ~$0.085/GB after |

---

## Where to plug env vars in

Every backend var goes in `backend/.env.example` (documented) → your real `.env`/launch-script env → the relevant service's `application.yml` as `${VAR_NAME}`. Every frontend var goes in `frontend/.env` (create it, gitignored) as `VITE_*`, read via `import.meta.env.VITE_*`. Restart the affected service(s) after any env var change — Spring Boot and Vite both only read them at startup.
