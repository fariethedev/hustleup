# Website → native app parity

Android and iPhone are developed together. This is a native React Native/Expo app, not a website wrapper. Existing screens are not assumed production-ready merely because they compile.

## First implementation slice

- Authentication update: shared dotted login/registration forms; Account/Profile/Finish registration, password confirmation and website password policy, username availability, terms consent, optional city/phone, verification-code entry/resend, and no session persistence until a token is returned. Password login opens Feed. Native OAuth, Turnstile integration, onboarding/admin destination parity, and email-delivery device QA remain outstanding; nonfunctional social buttons are not shown.

- Production API configuration takes priority over Metro's LAN address; `EXPO_PUBLIC_API_URL` can explicitly target a test server.
- Android APK preview, iOS internal/simulator, and store-release build profiles.
- Orders combine marketplace bookings, store purchases, and store sales, with real loading/error/refresh states.
- Versioned negotiation turns, acceptance, counteroffers and secure Stripe checkout for purchases.
- Delivery icons, tracking details, buyer receipt approval, and problem reports with retained input on failure.
- Open claims/unpaid orders disable receipt approval; the backend remains the authority.
- Payment status is refreshed on app foreground, never inferred from closing Stripe.
- Native bank setup and Manage bank & view payouts; validated Stripe-hosted links.
- Premium stars on profiles, seller bylines and storefronts.
- Orders use system light/dark appearance. Full-app theme parity is still pending.
- Privacy now loads/saves the server's private-account setting, with a follow-request inbox for approval/decline, retry states, and system light/dark appearance. Removed local-only privacy switches that implied protections they did not enforce.

## Remaining implementation and device acceptance

### Native page work added in October 2026

- Home now has the website hero and live marketplace, shop and event sections; the previous Home feed is preserved under Feed.
- Explore merges store products with listings, adds creators and filters, and uses non-sticky search and shared product cards.
- Native Dashboard overview, activity, ticket wallet, ticket details/QR and organiser door scanning have been added.
- Jobs browse/detail/application and news browse/detail screens now use the existing APIs. Publisher workflows are not yet ported.
- Storefronts now use Explore's product cards and light/dark colours, and connect named photo/video highlights with owner upload/edit/save controls.
- Discovery/cart-identifier and order-permission checks pass. Targeted lint checks pass. Physical-device camera, media upload/playback and complete checkout acceptance remain outstanding.
- The time-of-day greeting still exists in the preserved Feed screen. It is not on the new website-style Home screen; the requested change to that greeting needs clarification.
- Native forgot/reset-password screens replace the website-only login alert. Reset links can be supplied by a native deep link or pasted from email; web universal-link association is not configured. Password rules match the website and are checked by `scripts/check-mobile-passwords.mjs`. Local development disables outgoing mail, so actual email delivery remains unverified.
- Reviews replaces the profile placeholder with received ratings, a rating breakdown and submission for completed bookings/fulfilled store orders. Backend eligibility and duplicate checks remain authoritative. Accessible from Dashboard and More.

The list below remains the broader acceptance backlog, not a claim that every part of each feature is missing.

1. Discovery: include store products alongside marketplace listings, full-size cards, filtering and sorting; storefront highlight creation/editing and native photo/video playback.
2. Messages: persistent attachment uploads, signed URL refresh, compact matches, negotiation cards, unread-thread semantics and deep-linked push notifications.
3. Feed/stories: photo/video composer, crop/edit/delete, playback/retry, comments/reposts. Replace deprecated expo-av before release.
4. Bond: paid entitlement checks, profile editor/preferences, gesture-driven card stack, match transitions, reporting/blocking, compact messaging entry points.
5. Jobs/news/events: real browse/details/apply/publish flows; ticket wallet and door scanning.
6. Swap & Top: existing-listing selection, cash top-up, alternate proposals, payment/delivery/receipt/dispute states.
7. Accounts: private-profile visitor UI and requested-follow states, onboarding, recovery, verification, notifications and account deletion. Settings privacy and incoming follow-request decisions are implemented; physical-device acceptance remains pending.
8. Plans/leaderboards: native membership screen now reads server prices/current subscription; Free/Plus/All Access feature lists, expiry and refresh are available. Bond and the native leaderboard require All Access; listing publishing and anonymous posting require a paid tier. Apple/Google accounts are not yet set up, so native purchasing is explicitly unavailable. Store billing, receipt validation/restoration and physical-device acceptance remain outstanding; website feature migration is not complete.
9. Seller dashboard: listings/store editing, appointments, inventory, analytics, notifications and remaining placeholders.
10. Release hardening: secure token storage, full light mode/accessibility, final brand assets, deep links/payment returns, permissions, offline/expired-session handling, native media migration, physical-device QA.

## Release gates

- Railway billing must permit deployment of website/backend commit `3c4905b`; it was pushed but the deployment attempt was refused because the trial expired.
- Confirm the intended Expo account/project and final identifiers (`space.hustlespace.app` is the proposed Android package/iOS bundle ID; no signing identity has been created).
- Link EAS project, configure signing under the owner's accounts, and review build costs before starting remote builds.
- iOS internal installs need Apple provisioning and registered test devices; TestFlight/store distribution needs the appropriate developer accounts.
- Replace starter app/splash icons, configure native permission copy and push credentials, complete privacy/store disclosures.
- Native Hermes bundle export is a compile check only: it is not an APK/IPA, an emulator run, or device acceptance.
