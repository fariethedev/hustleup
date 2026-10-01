# Cloudflare image storage

## Current state

Cloudflare's 16 official skills and five MCP servers were installed for Codex. Main Cloudflare MCP OAuth succeeded with account-discovery and R2 scopes. Other account-specific MCPs can request their own login when used. Restart Codex to load the new tools into the interactive session; a noninteractive discovery attempt was blocked by tool approval, not by Cloudflare authentication.

The application integration is prepared and remains **disabled by default**. The Cloudflare account has an empty `hustlespace` R2 bucket in the default jurisdiction (Cloudflare reports storage location `EEUR`). No existing files or database records were moved or deleted. Production continues using its current storage.

The bucket's read-only CORS policy is configured for the local frontend origins
(`http://localhost:5173`, `http://localhost:5174`, `http://localhost:3000`) and the intended
production origins (`https://hustlespace.space`, `https://www.hustlespace.space`). It allows only
`GET` and `HEAD` with a one-hour preflight cache. The bucket currently contains no objects.

## Storage boundary

`FileStorageService.storePublicMedia` sends explicitly public raster images to R2 when enabled: avatars, shop banners/products, listings, feed photos (including replacements), story images, community banners, publisher logos, news and job-board images.

`store` keeps its existing storage behavior for direct messages, verification documents, dating photos, swap proofs and job-application attachments. Videos also remain on their existing backend. Never expose the existing mixed-content bucket as public. Use a new bucket containing only the designated public images.

Use a verified custom delivery domain for production. Stable URLs fit existing URL columns, avoid expiration and preserve the current frontend upload contracts. Existing AWS credentials/CDN configuration must remain unchanged so old images, videos and email integrations continue working. AWS images are not automatically copied or rewritten.

## Activation checklist

1. Finish delegating `hustlespace.space` to Cloudflare. The zone is currently `pending` and still observes the registrar's Spaceship nameservers. At the registrar, replace them with `clarissa.ns.cloudflare.com` and `kyree.ns.cloudflare.com`, then wait for the zone to become active.
2. Connect the unused custom subdomain `images.hustlespace.space` to the existing `hustlespace` bucket once the zone is active. Verify that the domain is active and serves an uploaded test image. Do not overwrite existing DNS records. Keep the development `r2.dev` URL disabled.
3. The bucket CORS policy is already configured for GET/HEAD from the actual local and intended production web origins. Uploads remain server-side, so no browser PUT permission is needed.
4. Create dedicated R2 Object Read & Write S3 credentials scoped only to the `hustlespace` bucket. OAuth access to MCP is not a replacement for backend S3 credentials. Store credentials directly in Railway variables; never paste them into chat or source control.
5. Add the variables below to auth, social and marketplace. Keep the feature disabled until credentials, domain, upload/download and browser CORS checks pass. Leave notification uploads on their current backend.
6. Deploy the tested code and enable R2 for public images. Verify avatar, feed creation/edit, listing and shop image uploads, and confirm old AWS images still load. Verify that private-upload paths never call R2.

```dotenv
R2_IMAGES_ENABLED=false
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=hustlespace
R2_ACCESS_KEY_ID=<bucket-scoped-access-key>
R2_SECRET_ACCESS_KEY=<secret-in-Railway-only>
R2_PUBLIC_BASE_URL=https://images.hustlespace.space
```

For an EU jurisdiction bucket use `https://<account-id>.eu.r2.cloudflarestorage.com`; the endpoint must match the bucket. The SDK uses region `auto`, path-style requests and disabled chunked encoding. Enabled but incomplete configuration fails startup rather than silently losing new uploads on an ephemeral disk. An R2 upload error is returned as a failure, not retried against another storage provider.

The delivery domain is public by design; only explicitly public-media call sites may use it. New UUID object keys avoid overwriting existing images. A one-day public cache lifetime is used; deletion/moderation may also require a CDN purge. No automatic retention/deletion rules are configured.

## Sources

- https://developers.cloudflare.com/agent-setup/prompt.md
- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/buckets/cors/
