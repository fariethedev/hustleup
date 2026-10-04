# Storefront discovery and highlights

Explore and Explore Listings combine marketplace listings with products from published shops. Store products retain `shop:<shopId>:<productId>` cart identities and use shop checkout, never the marketplace booking checkout. Out-of-stock store products are excluded from discovery; storefronts retain their unavailable cards. A failure of one collection source leaves the other visible with a retry notice.

Storefront collections and recommendations reuse ListingCard, including its 4:5 media area. Explore's toolbar remains in normal document flow.

Owners manage named Highlights directly on their storefront. Collections support photos and videos, add/remove media, rename, delete, slide navigation, timed photo playback with pause, and video controls. Limits: 12 collections, 20 media items per collection, 40-character names; the uploader limits individual files to 20 MB. Existing shop media upload authorization and storage are reused. The shop PATCH validates and persists collections; unpublished shop details remain owner-only.

Deploy the backend with Flyway migration V35 before releasing the highlights UI. No live migration or deployment was performed during local implementation.

Swap offers on active marketplace listings support an owned listing or described item with an optional photo, plus a cash amount and payer direction. Top-ups are settled directly between users; submitting an offer does not charge a payment method. Existing acceptance, decline, withdrawal and receipt-confirmation endpoints remain in place.

Verification:

- `node scripts/check-explore-scroll.mjs` (Vite 5173 and Chrome debugging 9222).
- `node scripts/check-storefront-updates.mjs` (same prerequisites; fixture-backed API and media uploads).
- `node --test frontend/src/utils/storeListings.test.js`.
- `backend/mvnw.cmd -pl hustleup-marketplace -am test` from backend with Java 21.
- `npm run build` from frontend.

Before production rollout, verify a real image and supported video upload/playback on iOS and Android against configured storage. The browser suite does not test real media storage or video encoding, and the migration has not been exercised against a live database.
