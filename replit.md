# LedgerEntries — ledgerentries.com

## Overview

A full-stack daily shop accounting web application for small businesses and shopkeepers. Track cash in/out, digital payments, credits, and profit. SEO-optimized, mobile-first, with email verification and an admin panel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui (artifact: shop-ledger)
- **API framework**: Express 5 (artifact: api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Auth**: Cookie sessions (cookie-session) + bcryptjs
- **Email**: Nodemailer + Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD secrets)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Routing**: wouter (frontend)
- **Security**: helmet, express-rate-limit

## Route Structure

- `/` — Public landing page (redirects to /app if logged in)
- `/login` — Login page
- `/signup` — Sign up page
- `/forgot-password` — Password reset request
- `/reset-password` — Password reset with token
- `/verify-email` — Email verification
- `/app` — Protected dashboard (home)
- `/entries` — Entries list with recycle bin
- `/credits` — Credit/khata tracker
- `/profits` — Profit per entry view
- `/reports` — Daily/weekly/monthly reports
- `/backup` — JSON data export
- `/settings` — Account settings, admin link
- `/admin` — Admin panel (admins only, standalone no layout)

## Features

- **Landing page** — Hero, features, how-it-works, CTA, footer
- **Login/Signup** — Username + password auth, password reset via email token
- **Email verification** — Required gate: users with unverified email see a "verify your email" screen before accessing the app
- **Dashboard** — Total cash + digital balance, Cash In / Cash Out buttons, today's entries
- **Entries** — Full list with filter tabs (All, In, Out, Recycle Bin), inline edit/delete, recycle bin restore
- **Credits** — Customer credit tracking (given/received), mark as paid, auto-suggest customer names, receive partial/full payment
- **Profits** — Per-entry profit input with daily/weekly/monthly totals
- **Reports** — Daily/weekly/monthly financial summary + entries list
- **Backup** — Download full data as JSON
- **Settings** — Account info, logout; Admin link if admin
- **Admin panel** — Platform stats, user list (entries/credits count, role, verification), role toggle, delete user; Deleted Records tab showing all soft-deleted entries across all users with permanent delete + purge all

## Security

- `helmet` — Sets security headers (XSS, HSTS, etc.), hides X-Powered-By
- `express-rate-limit` — Auth routes: 20 req/15min; API routes: 200 req/min
- Global error handler — Never exposes stack traces or file paths in responses
- Body size limited to 1mb
- Sessions: httpOnly, sameSite=lax, secure in production
- Admin access: `requireAdmin` middleware checks DB role
- First registered user gets `role='admin'`

## Database Schema

- `users` — id, username, password_hash, email, email_verified, verification_token, verification_token_expiry, role, language, reset_token, reset_token_expiry
- `entries` — id, user_id, type (cash_in/cash_out), amount, description, payment_method (cash/digital), profit, is_credit, customer_name, deleted_at, entry_date
- `credits` — id, user_id, customer_name, amount, description, type (given/received), status (pending/paid), due_date

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Routes

- `POST /api/auth/signup` — Create account
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token
- `POST /api/auth/verify-email` — Verify email with token
- `POST /api/auth/resend-verification` — Resend verification email
- `GET/POST /api/entries` — List and create entries
- `GET/PATCH/DELETE /api/entries/:id` — Get, update, soft-delete entry
- `PATCH /api/entries/:id/restore` — Restore from recycle bin
- `PATCH /api/entries/:id/profit` — Set profit for an entry
- `GET/POST /api/credits` — List and create credits
- `PATCH/DELETE /api/credits/:id` — Update/delete credit
- `GET /api/customers` — List customers for autocomplete
- `GET /api/reports/summary` — Balance summary
- `GET /api/reports/entries?period=daily|weekly|monthly` — Entries report
- `GET /api/reports/profit?period=daily|weekly|monthly` — Profit report
- `GET /api/backup/export` — Export all data as JSON
- `GET /api/admin/stats` — Platform stats (admin)
- `GET /api/admin/users` — All users (admin)
- `PATCH /api/admin/users/:id/role` — Change user role (admin)
- `DELETE /api/admin/users/:id` — Delete user (admin)
- `GET /api/admin/deleted-entries` — All soft-deleted entries across all users (admin)
- `DELETE /api/admin/entries/:id/permanent` — Permanently delete one entry (admin)
- `DELETE /api/admin/entries/purge-deleted` — Purge all deleted entries (admin)

## Environment Variables / Secrets

- `SESSION_SECRET` — Cookie session secret
- `GMAIL_USER` — Gmail address for sending verification/reset emails
- `GMAIL_APP_PASSWORD` — Gmail app password (not your Google account password)
- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit)
