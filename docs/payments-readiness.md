# Seller payments and memberships

## Global commerce verdict

**This does not make the app ready for global commerce.** Important remaining work includes
Stripe Connect eligibility and payouts by country, currency-aware payment and refund handling,
replacing fixed exchange rates, country-specific address and tax support, international shipping
and returns, full translations, and consistent time-zone handling for bookings. The UI still
lacks a language or display-currency preference, and web city entry remains limited to
suggestions. R2 image delivery also has activation steps recorded in
[`CLOUDFLARE_IMAGES.md`](./CLOUDFLARE_IMAGES.md).

## International readiness status

The web and mobile clients now format monetary values with the viewer device's locale and
currency rules. Seller listing creation on both clients can select a currency; the web
supports a broader set and mobile has a shorter common-currency list. City suggestions and
discovery filters include selected cities outside Poland, while sellers can still enter a
city directly in mobile. These are presentation and data-entry improvements, not global
payment enablement.

The product is **not ready to claim worldwide commerce support**. Before opening a country,
confirm and implement all of the following for that market:

- **Stripe Connect country support:** verify the platform's country, connected-account type,
  onboarding capabilities, payout currencies, payment methods, and cross-border transfer
  eligibility. Availability is determined by Stripe and account configuration; a currency
  dropdown does not imply that checkout or seller payouts work there.
- **Currency correctness:** replace the fixed `FX_TO_PLN` conversion table used for mixed
  cart display and price sorting with a dated FX source, stale-rate behavior, and clear
  disclosure. Confirm supported ISO currency codes and each currency's minor-unit precision
  end to end (web validation, mobile validation, database, checkout, fees, refunds, and
  settlement). Membership plans and their Stripe charge remain PLN-only today.
- **Country and address model:** persist country and structured address fields; validate
  postal codes, regions, phone numbers (E.164), and tax identifiers by country. City-only
  suggestions are not a substitute. The database/API currently do not provide a complete
  buyer shipping-address and seller-country model.
- **Tax, consumer, and platform rules:** determine VAT/GST/sales-tax collection and invoices,
  marketplace deemed-seller obligations, refunds, cancellation rights, age restrictions,
  prohibited goods, seller verification, sanctions screening, and local marketplace
  disclosures with qualified local advice.
- **Shipping and fulfilment:** replace Poland-centric carrier hints and manual shipping terms
  with country-pair serviceability, rates, customs/duties, tracking, returns, and delivery
  estimates. Some orders will need to be blocked when no supported route exists.
- **Language and support:** the app's interface and legal/support content remain primarily
  English, with some Poland-specific copy. There is no complete translation system or
  per-account language preference. Translate and review user-facing screens, emails,
  notifications, policies, moderation guidance, and support before each launch.
- **Time zones:** browser and device formatting is locale-aware, but many backend timestamps
  and appointment slots use `LocalDateTime` without an offset or IANA zone. Store event
  instants in UTC and preserve each seller/event IANA time zone for schedules and daylight
  saving transitions before supporting cross-zone bookings.
- **Hosting and data transfers:** verify production origins, API reachability, image delivery,
  data residency/transfer terms, backups, deletion, incident response, and regional
  availability. The R2 activation checklist below `docs/CLOUDFLARE_IMAGES.md` remains a
  separate deployment prerequisite and is not a global CDN/DR plan.

Current client limitations: automatic number/currency formatting follows the device locale;
users cannot choose a display locale or display currency preference. The listed cities are
suggestions, not a global geographic dataset, and arbitrary city entry is not consistently
available on web. UI translation, server-side time-zone normalization, and full global
country-specific payments/tax/shipping are not implemented.

## Membership contract

- Free: buying, community feed, profile and messaging.
- Plus: 9 PLN for one month, adds selling, storefront and booking tools.
- All Access: 20 PLN for one month, adds Bond and leaderboards.
- These are prepaid terms, not automatically recurring subscriptions. Transaction fees are separate.
- `PLUS` is the stored selling tier. `VERIFIED` remains the stored All Access value, preserving existing paid accounts.
- A same-tier renewal extends the existing expiry. Switching tiers converts remaining active paid time using the old/new monthly price ratio, then adds the purchased term. Cancelled time is not credited.
- Payout account access is authenticated but independent of membership. Expired sellers must retain access to earned money.

## Seller workflow

1. Open **Seller payments** from More or Dashboard → Payments.
2. Verify your email, then connect or resume Stripe Express onboarding.
3. Stripe collects identity and bank details. Returning to the app is not evidence of successful verification; the server retrieves current Stripe status.
4. Complete any outstanding Stripe requirements. Marketplace transfer capability and bank payout capability are reported separately.
5. Buyer payments remain subject to the existing fulfilment/protection/dispute rules. Eligible earnings are transferred to the seller's Stripe account after marketplace fees; postage passes through without a platform fee.
6. **Manage bank & view payouts** opens a fresh account-specific Express dashboard link. Stripe reports the bank payout schedule and arrival estimates.

Transfer retries use stable, distinct Stripe idempotency keys for bookings and shop orders. Stripe's idempotency retention is finite; this is retry protection, not a replacement for durable reconciliation after extended outages.

## Read-only Stripe check — 2026-10-03

The local configuration is **test mode**. Read-only API inspection found five connected test accounts; four have submitted details, enabled payouts and active transfers. Both configured webhook endpoints are enabled.

The registered event lists are incomplete. Before relying on delayed payments and abandoned-checkout inventory recovery, configure these events in Stripe:

| Endpoint | Required events |
| --- | --- |
| `/api/v1/payouts/webhook` | `account.updated`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` |
| `/api/payments/webhook` | `checkout.session.completed`, `checkout.session.async_payment_succeeded` |

At inspection, the payout endpoint subscribed only to `account.updated` and `checkout.session.completed`; the subscription endpoint subscribed only to `checkout.session.completed`. No Stripe configuration, account or money was changed during this check.

## Release verification

### Confirmed onboarding blocker — 2026-10-03

A test-mode account-creation request matching the backend's Express/PL/capabilities parameters and SDK API version (`2025-01-27.acacia`) returned HTTP 400. Stripe explicitly requires enabling Accounts v1 compatibility support for this platform. No diagnostic account was created.

The Stripe account owner must open [Accounts v1 support](https://dashboard.stripe.com/settings/developers/api-policies/feat_accounts_v1_support) in the correct platform account/environment and enable support for this existing integration. Then retry bank setup. This is an account-level policy, not an expired onboarding link, bad seller bank information or an SDK version to bypass. Check the corresponding setting before enabling live onboarding as well.

Until that setting is enabled, the backend returns `503 PAYOUT_SETUP_CONFIGURATION_REQUIRED` instead of incorrectly calling it a temporary provider outage. A migration to Accounts v2 is a separate integration change; do not silently change account responsibilities, replace seller accounts or switch payment flows to work around the policy.

- Deploy frontend, common library and dependent social, marketplace and subscription services together so Plus permissions agree.
- Railway backend services track `deploy/railway`, while the frontend tracks `main`. A push to `main` alone does not release backend endpoints. Advance the deployment branch to the verified release commit and confirm Railway reports successful startup; do not assume the frontend deployment updated the API.
- Set each service's correct Stripe secret and each endpoint's distinct signing secret; never interchange test and live credentials.
- Verify the externally reachable webhook URLs, required event subscriptions and successful delivery responses in Stripe.
- In test mode, complete onboarding and a buyer checkout, confirm webhook processing, fulfil an order, then confirm receipt. Verify one seller transfer, fee/postage amounts, retry safety and dashboard access. Exercise incomplete verification, a failed provider request and an open dispute.
- In live mode, the platform and seller must complete Stripe's activation requirements. A controlled live transaction and confirmed bank deposit are still required to establish real-money end-to-end readiness.

Browser regression checks: start Vite on port 5173 and a temporary headless Chrome profile on debugging port 9222, then run `node scripts/check-payments-ui.mjs`. These checks use explicit fixtures and never create payments.

Stripe reference: [Express dashboard integration](https://docs.stripe.com/connect/integrate-express-dashboard).
