# HustleUp Roadmap

This roadmap represents approximately **30 hours** of planned development. It
prioritises release safety, a reliable transaction flow, and closing the gap
between the web and mobile clients.

## Phase 1 — Release and data hygiene (6 hours)

- [ ] Remove or move SQL backups and user-uploaded media out of the public
  repository after confirming retention requirements. (2h)
- [ ] Complete a repository-wide secret scan, rotate any credential exposed in
  current files or Git history, and add CI secret scanning. (2h)
- [ ] Reconcile `.gitignore`, upload storage, environment documentation, and
  deployment scripts so local data cannot be accidentally staged. (2h)

## Phase 2 — Production foundations (5 hours)

- [ ] Replace environment-specific paths and assumptions in startup scripts with
  portable configuration. (2h)
- [ ] Verify MySQL migrations from a clean database and document backup and
  rollback procedures. (2h)
- [ ] Add a production readiness checklist covering CORS, JWT rotation, Stripe
  webhooks, email, media storage, and error monitoring. (1h)

## Phase 3 — Authentication, privacy, and trust (5 hours)

- [ ] Finish and test email verification, password reset, OAuth, and session
  teardown across web and mobile. (2h)
- [ ] Review account privacy, blocking, reporting, moderation, and PII exposure
  paths with integration tests. (2h)
- [ ] Add rate-limit and abuse-case regression tests for authentication,
  messaging, uploads, and public profile endpoints. (1h)

## Phase 4 — Marketplace completion (6 hours)

- [ ] Exercise the full seller journey: create a listing, configure a shop,
  negotiate a booking, accept payment, fulfil the order, and receive payout. (2h)
- [ ] Complete buyer protection, claims, cancellation, refunds, and notification
  states with explicit state-transition tests. (2h)
- [ ] Validate event ticket issuance and door scanning, rental/job listing
  flows, reviews, and search indexing. (2h)

## Phase 5 — Mobile parity and usability (5 hours)

- [ ] Finish parity for discovery, listings, shops, cart/orders, profiles,
  messaging, subscriptions, tickets, and seller banking. (2h)
- [ ] Test Android and iOS exports on real devices, including deep links,
  camera/document uploads, push notifications, and offline/error states. (2h)
- [ ] Resolve accessibility, loading, empty-state, and responsive-layout issues
  found during web/mobile review. (1h)

## Phase 6 — Verification and operations (3 hours)

- [ ] Add a repeatable smoke-test script for gateway health, authentication,
  listings, messaging, and checkout test mode. (1h)
- [ ] Standardise structured logs, correlation IDs, Sentry context, and health
  checks across all six backend services. (1h)
- [ ] Publish contributor setup, API examples, release notes, and the final
  ownership/license decision. (1h)

## Definition of done

A milestone is complete when its code, tests, documentation, and configuration
are committed together; secrets and real user data remain outside Git; a clean
checkout can be started using the documented commands; and the relevant web and
mobile flows have been smoke-tested against a non-production environment.
