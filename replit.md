# Daily Shop Ledger

## Overview

A full-stack daily shop ledger web application for small businesses and shopkeepers to track their daily accounts, credits, and profit. SEO-optimized and mobile-first.

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
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Routing**: wouter (frontend)

## Features

- **Login/Signup** — Username + password auth, password reset via email token
- **Home/Dashboard** — Total cash + digital balance, Cash In / Cash Out buttons, today's entries
- **Entries** — Full list with filter tabs (All, In, Out, Recycle Bin), inline edit/delete, recycle bin restore
- **Credits** — Customer credit tracking (given/received), mark as paid, auto-suggest customer names
- **Profits** — Per-entry profit input with daily/weekly/monthly totals
- **Reports** — Daily/weekly/monthly financial summary + entries list
- **Backup** — Download full data as JSON
- **Settings** — Account info, language (English), logout
- **SEO** — robots.txt, sitemap.xml, JSON-LD structured data, Open Graph tags

## Database Schema

- `users` — id, username, password_hash, email, language, reset_token, reset_token_expiry
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
