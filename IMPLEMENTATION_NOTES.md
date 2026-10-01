# Marketplace and mobile UI update

## Delivered

- Pick-one listing categories with descriptions/examples and clearer three-step creation.
- Listing, shop and feed photo cropping; owner-checked replacement of existing feed photos.
- Business-type shop setup, salon services/appointments and grocery inventory controls.
- Transactional inventory reservations, insufficient-stock rejection and idempotent restoration on unpaid checkout expiry/failure; migration V34.
- Persistent listing/product cart actions, currency-aware checkout and safe redirects away from the retired negotiation page.
- Stripe-hosted bank onboarding with server-confirmed status and retry/return handling.
- Searchable communities, join/leave actions, community-specific feeds and explicit posting destination.
- Mobile anonymous controls, redesigned Explore/product cards and responsive homepage hero.
- Native listing creation/cropping, cart/checkout, bank onboarding and storefront products/services.

## Verification (2026-10-01)

- Web production build passed; bundle-size warning remains.
- Android Expo/Hermes export passed (`mobile/dist-review`). This is not an installed-device or iOS test.
- Scoped web lint passed. Scoped native lint has no errors and eight existing warnings.
- Backend Maven tests/package passed. Surefire reports: 57 tests, zero failures/errors, across common, social and marketplace.
- Static API comparison: 273 literal client calls against 213 controller mappings, no unmatched patterns. This checks route shapes, not every payload/authorization contract.
- Live read-only smoke tests: seven public reads returned 200; eighteen protected reads correctly rejected signed-out requests with 401/403. All 25 probes passed. Rate-limited to avoid exceeding the gateway limit.
- Fixture-backed Chrome checks passed: mobile width, hero, listing/shop cart persistence, retired negotiation redirect, community join/feed selection, anonymous toggle, category selection, crop/export, bank status and desktop layouts. Screenshots in `artifacts/ui-review` are local ignored artifacts.

Authenticated success paths, real Stripe test checkout/onboarding/webhooks, concurrent database requests and physical-device behavior still require end-to-end verification. No claim is made that every endpoint returns 200; creation/deletion/authentication have other valid status codes. No real payment or bank account was created during these checks.

## Running locally

| Service | Address/port |
| --- | --- |
| Web | http://localhost:5173 |
| API gateway | http://localhost:8000 |
| Auth / Social / Marketplace | 8081 / 8082 / 8083 |
| Subscription / Notification | 8084 / 8085 |
| Expo / Metro | http://localhost:8086 |
| MySQL | 3306 |

The six backend services and Expo were started in hidden background processes. The existing web server and MySQL were reused. Local Flyway startup applied pending migrations V30–V34 successfully. No database reset was performed.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1` starts packaged services, leaves occupied ports untouched, and writes separate logs under `backend/logs/dev-<timestamp>`. Package backend changes before restarting. It loads secrets from the ignored `backend/.env`, refuses live Stripe keys, uses the local `hustleup` MySQL schema, disables outgoing mail/cloud indexing for this launch, and does not modify the environment file. Expo is localhost/offline with live reload, suitable for local development/emulators; physical phones need an explicitly configured reachable LAN address.

Run `node scripts/check-api.mjs` for read-only live checks, `--contracts` for route comparison, or `--inventory` for the route listing. Set `API_TOKEN` privately for authenticated GET checks; it is never printed. Some account-specific routes may legitimately have no resource for a new account. Browser checks in `scripts/check-ui.mjs` require Vite and a temporary Chrome debugging profile on port 9222 and use fixtures, not live credentials.
