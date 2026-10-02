# FarmWith identity stack

This repository contains a dockerised authentication stack for **FarmWith** consisting of:

- **FastAPI** backend with JWT issuance, local username/password authentication, password reset email delivery via SES, and optional Authentik OIDC single sign-on.
- **React (Vite)** frontend that exposes buyer and enterprise login experiences with explicit username/password and SSO entry points.
- **PostgreSQL** database (Postgres 15) for local development. In production you can point the backend at your Supabase instance.

## Features

- Secure password storage using Argon2.
- Configurable Authentik OIDC integration (enabled via `ENABLE_SSO=true`).
- JWT-based session handling with `/auth/me` endpoint for profile introspection.
- Frontend SSO callback workflow with session persistence.
- Password reset flow that emails a new password through Amazon SES SMTP credentials.
- Email verification flow for new registrations.

## Prerequisites

- Docker and Docker Compose.
- Supabase/PostgreSQL connection string (for production, replace the example in `.env.example`).
- Authentik OIDC provider details (client ID/secret, issuer/authorize/token endpoints).

## Configuration

Copy the example environment file and adjust values:

```bash
cp .env.example .env
```

### Core settings

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Use the Supabase URI or the local `db` container. |
| `JWT_SECRET_KEY` | Secret for signing API JWTs (generate a long random string). |
| `SESSION_SECRET_KEY` | Secret for encrypting session cookies used during the Authentik handshake. |
| `REMEMBER_ME_EXPIRE_DAYS` | Lifetime (in days) for access tokens issued when "Remember me" is checked (default 30). |
| `FRONTEND_URL` | External URL that serves the React app. Used for OIDC redirect after login. |
| `BACKEND_URL` | External URL for the FastAPI service (used as the redirect base). |
| `API_BASE_URL` | Internal URL that the frontend uses to contact the backend when running in Docker (defaults to `http://backend:8001`). |
| `ALLOWED_ORIGINS` | Comma-separated list of origins permitted by CORS (defaults to `https://farmwith.in,https://farmwith.online,http://localhost:5173`). |
| `SMTP_HOST` | SMTP endpoint (SES: `email-smtp.ap-south-1.amazonaws.com`). |
| `SMTP_PORT` | SMTP port (SES supports 25/587/2587 for STARTTLS or 465/2465 for TLS wrapper). |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | SMTP credentials from the SES console. |
| `SMTP_FROM` | From address for verification and password reset messages (e.g., `admin@farmwith.in`). |
| `SMTP_USE_TLS` | Whether to issue `STARTTLS` before sending mail (default `true`). |
| `CONTRIBUTION_INBOX` | Email address that receives new contribution requests from the dashboard. |

### Authentik SSO

Set `ENABLE_SSO=true` to expose the SSO option on the enterprise login card. Provide either the discovery URL (`OIDC_CONFIGURATION_URL`) **or** the individual authorize/token/userinfo/logout endpoints. Populate `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` with the values from your Authentik application (`farmwith`). When `ENABLE_SSO` is false the frontend will show a popup explaining that SSO is not configured.

Registration now requires email verification. New users register with email/password, optionally add phone and company name, and receive a verification link at `https://farmwith.in/verify-email?token=...`. Login stays blocked until the email is verified.

## Running locally

```bash
docker compose up --build
```

Services exposed:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8001>
- Local Postgres (optional for dev): `localhost:5432`

### Using Supabase instead of the local Postgres container

Update `DATABASE_URL` in `.env` to the Supabase connection string, then comment out or remove the `db` service in `docker-compose.yml` if not needed.

### Running behind a reverse proxy

When you terminate TLS at Nginx (or any other reverse proxy) make sure the FastAPI process respects the `X-Forwarded-Proto` header so the OpenAPI schema advertises the correct `https` URLs. The provided Docker image already runs Uvicorn with `--proxy-headers --forwarded-allow-ips=*`. If you invoke Uvicorn manually, add those flags to your command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --proxy-headers --forwarded-allow-ips "*"
```

> **Heads-up about TLS redirects**
>
> Certbot’s default `ssl.conf` snippet adds `if ($host = example.com) { return 301 https://$host$request_uri; }` to **both** the HTTP and HTTPS server blocks when you enable the redirect option. Leaving that `return` inside the TLS block causes Nginx to endlessly reply with `301 Moved Permanently` before the request reaches Uvicorn, so `https://api.farmwith.in/docs` never loads. Keep the 301 redirect only on the port 80 server.

Example configs for the FarmWith domains live in [`deploy/nginx`](deploy/nginx). They redirect traffic exactly once on port 80 and forward HTTPS traffic straight to the Docker containers:

- [`deploy/nginx/api.conf`](deploy/nginx/api.conf) — proxies `api.farmwith.in` to `localhost:8001`.
- [`deploy/nginx/frontend.conf`](deploy/nginx/frontend.conf) — proxies `farmwith.in` to `localhost:5173`.

Reload Nginx after installing the files (`sudo ln -s /path/to/repo/deploy/nginx/api.conf /etc/nginx/sites-enabled/api.farmwith.in` etc.) and Certbot will continue to manage the certificates referenced in those files.

## API overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/auth/register` | POST | Register buyer/enterprise users with password. |
| `/auth/login` | POST | Username/password login. |
| `/auth/forgot` | POST | Resets the password and emails a new one via SES. |
| `/auth/config` | GET | Returns whether SSO is enabled for the frontend. |
| `/auth/me` | GET | Returns current user profile (requires Bearer token). |
| `/auth/sso/login` | GET | Starts the Authentik OIDC flow (browser redirect). |
| `/auth/sso/callback` | GET | Handles the Authentik callback and redirects to the frontend with a JWT. |

## Frontend workflow

- Buyers click "Sign in with username and password" to reveal the credentials form with “remember me” and “forgot password” actions.
- Enterprise buyers can either use password login or single sign-on if SSO is active; otherwise they see an inline “SSO not enabled” warning when clicking SSO.

## Security notes

- Always run behind HTTPS in production and set strong secrets.
- Rotate `JWT_SECRET_KEY` and `SESSION_SECRET_KEY` periodically.
- Keep SMTP credentials secret and rotate them regularly; SES will reject invalid credentials before sending mail.

## Development tips

- The backend automatically applies database migrations via SQLAlchemy metadata creation. For production, manage migrations explicitly (e.g., Alembic).
- Update `VITE_API_BASE_URL` through the frontend service environment if the backend URL differs between environments.
