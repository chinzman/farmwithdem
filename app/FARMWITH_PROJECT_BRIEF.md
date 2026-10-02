# FarmWith Project Brief

Use this as a compact rebuild prompt for the current FarmWith codebase snapshot.

## What FarmWith Is

FarmWith is a web app for a farm/community funding platform centered on a 40-acre hub in Tiruvallur, Tamil Nadu. It lets users:

- create an account with email/password
- verify email before login
- sign in with local auth or optional Authentik SSO
- browse farm projects and contribute financially or with support
- submit contribution interest that is emailed to the team
- view a personal dashboard of contribution/activity items after login

## Tech Stack

- Frontend: React 18 + Vite + TypeScript + React Router
- Backend: FastAPI + SQLAlchemy + Pydantic
- Auth: JWT access tokens, Argon2 password hashing
- Database: PostgreSQL
- Email: SMTP/SES for verification and password reset emails
- Optional SSO: Authentik OIDC
- Deployment: Docker Compose + Nginx reverse proxy

## Main Frontend Experience

- Landing/auth screen with:
  - buyer/login flow
  - register flow
  - SSO option for enterprise users
  - remember-me toggle
  - forgot-password action
  - dark/light theme toggle
- Project browsing screen with cards for multiple farm initiatives
- Each project card shows:
  - title, summary, location, timeline
  - needs
  - benefits/impact
  - tags
- Contribution modal/panel:
  - pick a project
  - choose funding or support type
  - enter name, contact, pledge amount, and note
  - submit authenticated contribution interest
- Authenticated dashboard:
  - profile summary
  - list of contribution/support items
  - recent events
  - actions like top up, continue, and request update

## Core Backend Behavior

- `POST /auth/register`
  - creates a local user
  - requires name, email, password, phone number
  - can store company name
  - sends a verification email
- `GET /auth/verify-email?token=...`
  - verifies the account
- `POST /auth/login`
  - returns a JWT access token
  - supports remember-me expiry
- `POST /auth/forgot`
  - resets password and emails a new one
- `GET /auth/config`
  - tells the frontend whether SSO is enabled
- `GET /auth/me`
  - returns the current user profile
- `GET /auth/sso/login` and `/auth/sso/callback`
  - OIDC login flow via Authentik
- `GET /auth/me/dashboard`
  - returns profile, summary stats, dashboard items, and recent events
- `POST /auth/me/dashboard/items/{id}/top-up`
- `POST /auth/me/dashboard/items/{id}/continue`
- `POST /auth/me/dashboard/items/{id}/request-update`
- `POST /contributions`
  - emails a contribution request to the configured inbox
  - records the activity in the dashboard tables

## Data Model

- `users`
  - email/username, password hash, full name, phone, company
  - login attempts, last login
  - email verification fields
  - optional OIDC fields
- `dashboard_items`
  - per-user contribution/support items
  - project/site metadata
  - status, requested/accepted amount, notes, latest update
- `dashboard_events`
  - event log tied to dashboard items

## Content And Product Theme

- The app is built around a Tiruvallur 40-acre farm hub.
- Projects include livestock, poultry, dairy, fodder, aquaponics, perimeter security, agroforestry, utilities, nursery/training, and lease-out pods.
- The tone is practical, community-driven, and investment/support oriented.

## Environment And Deployment

- Docker Compose runs:
  - PostgreSQL
  - FastAPI backend on port 8001
  - Vite frontend on port 5173
- Nginx configs in `deploy/nginx/` proxy:
  - `farmwith.in` to the frontend
  - `api.farmwith.in` to the backend
- Important env vars:
  - `DATABASE_URL`
  - `JWT_SECRET_KEY`
  - `SESSION_SECRET_KEY`
  - `FRONTEND_URL`
  - `BACKEND_URL`
  - `ENABLE_SSO`
  - OIDC/AuthentiK credentials and endpoints
  - SMTP credentials and `CONTRIBUTION_INBOX`

## Rebuild Prompt

Build a responsive FarmWith web app with:

1. A polished landing/auth experience with register, login, forgot password, email verification, optional SSO, and theme toggle.
2. A project browsing UI showing multiple farm initiatives for the Tiruvallur 40-acre hub.
3. A contribution flow that lets authenticated users submit funding or support interest for a chosen project.
4. A private dashboard that tracks user contribution/support items and recent activity.
5. A FastAPI backend with JWT auth, PostgreSQL persistence, email verification, password reset emails, optional Authentik OIDC, and contribution email forwarding.

