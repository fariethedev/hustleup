# Social and negotiation update

Deploy backend migration V36 before the frontend. V35 adds named storefront highlights.

- Negotiations alternate between buyer and seller, retain offer history, reject stale versions and close on agreement. Accepted deals retain the server booking ID through checkout; client prices cannot authorize discounts.
- Message emails are gated by recipient/sender until the recipient opens the conversation. Subsequent messages still appear in-app. Email transport failure is logged; the gate provides at-most-once notification, not guaranteed delivery.
- Message reads refresh legacy storage URLs and sign durable private attachment keys without persisting expiring URLs. Private attachments require the separate `R2_PRIVATE_BUCKET` configuration. Previously lost local files cannot be recovered by this change.
- Local chat attachments use `/uploads/messages/` so the gateway routes to the messaging service rather than auth. Production currently has no R2/S3 configuration; local attachments remain bearer-link accessible and require a persistent volume to survive redeploys. Private R2 storage is supported but not enabled by this release.
- Private profiles hide profile details, posts, stories and reposts of private content from unapproved viewers. Existing followers retain access until removed. Marketplace listings, storefronts, display names and avatars remain public. Previously shared public media URLs are not revoked.
- Jobs and News use responsive editorial layouts. Bond uses a photo-led deck, heart actions, reduced-motion swipe exits and restores failed decisions instead of discarding profiles.

## Checks

Backend Maven suites cover negotiation authorization/turns, account visibility, private reposts, email gating/layout and attachment URL refresh. Frontend production build and store-listing unit tests pass. Fixture-backed browser scripts cover mobile/desktop Explore, events, storefronts, highlights, jobs/news, follow approval, failed/successful Bond swipes and agreed checkout.

These browser checks do not send live emails, take payments, create real matches or upload files to production. Verify real-device video playback and real attachment uploads separately.
