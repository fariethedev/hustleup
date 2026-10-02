# Seller payments and memberships

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

- Deploy frontend, common library and dependent social, marketplace and subscription services together so Plus permissions agree.
- Set each service's correct Stripe secret and each endpoint's distinct signing secret; never interchange test and live credentials.
- Verify the externally reachable webhook URLs, required event subscriptions and successful delivery responses in Stripe.
- In test mode, complete onboarding and a buyer checkout, confirm webhook processing, fulfil an order, then confirm receipt. Verify one seller transfer, fee/postage amounts, retry safety and dashboard access. Exercise incomplete verification, a failed provider request and an open dispute.
- In live mode, the platform and seller must complete Stripe's activation requirements. A controlled live transaction and confirmed bank deposit are still required to establish real-money end-to-end readiness.

Browser regression checks: start Vite on port 5173 and a temporary headless Chrome profile on debugging port 9222, then run `node scripts/check-payments-ui.mjs`. These checks use explicit fixtures and never create payments.

Stripe reference: [Express dashboard integration](https://docs.stripe.com/connect/integrate-express-dashboard).
