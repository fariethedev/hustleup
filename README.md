# HustleUp

HustleUp is a social marketplace for freelancers, independent sellers, creators,
and small businesses. It combines listings and shops with bookings, negotiation,
payments, reviews, event tickets, direct messaging, social feeds, stories,
follows, and premium networking through Hustle Bond.

The repository contains three clients/services:

- `frontend/` — React 19 + Vite web application using Redux Toolkit, React Router,
  Tailwind CSS, and Framer Motion.
- `mobile/` — Expo / React Native application for Android and iPhone, using Expo
  Router and the same API gateway.
- `backend/` — Java 21 Spring Boot microservices behind Spring Cloud Gateway:
  authentication, social, marketplace, subscriptions, notifications, and a
  shared library.

## Requirements

- Java 21
- Node.js and npm
- MySQL with a `hustleup` database
- Backend configuration copied from `backend/.env.example` to
  `backend/.env` (never commit the resulting file)
- Optional integrations for full functionality: Stripe, AWS S3 or Cloudflare
  R2, email, OAuth providers, Algolia, Sentry, and Turnstile

## Run locally

### Backend

From `backend/`, create and fill the local environment file, then build the
multi-module Maven project:

```powershell
Copy-Item .env.example .env
# Edit .env and set at least MYSQL_PASSWORD and JWT_SECRET
.\mvnw.cmd clean package
```

Start the six services with the supplied PowerShell launcher:

```powershell
.\start-services.ps1
```

The gateway listens on `http://localhost:8000`; the individual services use
ports `8081` through `8085`. The launcher reads secrets from `backend/.env` and
starts the services in minimized windows.

### Web client

```powershell
cd frontend
npm ci
npm run dev
```

Vite serves the web client locally. Configure its API base URL using the
frontend environment variables expected by `frontend/src` if your local
gateway is not the default.

### Mobile client

```powershell
cd mobile
npm ci
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to a reachable `/api/v1` gateway URL when testing on
a physical device. Do not put server secrets in Expo public variables or
`app.json`. See [`mobile/README.md`](mobile/README.md) for parity checks and
build profiles.

## Project documentation

- [`SRS.md`](SRS.md) — requirements, actors, use cases, architecture, and tests
- [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) — API and WebSocket reference
- [`INTEGRATIONS.md`](INTEGRATIONS.md) — third-party service setup
- [`ROADMAP.md`](ROADMAP.md) — planned development work and estimates

## Security and data hygiene

Never commit `.env` files, credentials, database dumps containing real user
data, or user uploads. The repository currently includes legacy SQL backups and
tracked media that should be reviewed before any public release. Rotate any
credential that has ever appeared in Git history, especially JWT, database,
Stripe, OAuth, email, and storage credentials.

## License

This project is licensed under the [MIT License](LICENSE).
