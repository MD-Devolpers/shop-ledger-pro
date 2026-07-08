---
name: Hostinger/pnpm monorepo deploy
description: Fix for pnpm version mismatch errors when deploying a pnpm-workspace monorepo to Hostinger (or similar hosts) via corepack.
---

When a repo pins `packageManager: "pnpm@X.Y.Z"` in `package.json`, and the deploy host's corepack has a different pnpm version baked in that it can't switch away from, install fails with an error like:

> This project is configured to use X.Y.Z of pnpm. Your current pnpm is vA.B.C. Corepack invoked pnpm with this version, and pnpm does not switch versions when running under corepack.

**Fix:** add `manage-package-manager-versions=false` to the root `.npmrc`. This disables pnpm's strict enforcement of the pinned `packageManager` version, letting whatever pnpm version is present on the host just run.

**Why:** Some hosting platforms (e.g. Hostinger's Node.js app hosting) run their own fixed pnpm/corepack version and don't have network access or permission to install the exact pinned version, so the strict version check hard-fails the build instead of warning.

**How to apply:** Any time a user reports a pnpm "packageManager"/corepack version-mismatch error during deployment (Hostinger, or other non-Render/non-Replit hosts), check root `.npmrc` first and add this setting rather than changing the pinned version (which could break the Replit dev environment).

Also relevant for Hostinger specifically: Shared/Business hosting plans do not support long-running Node.js backend processes in the traditional sense combined with PostgreSQL — PostgreSQL is not available on shared hosting (MySQL only). A full Express+Postgres app generally needs Hostinger VPS/Cloud hosting, or an external managed Postgres (Neon/Supabase/Render) if using Hostinger's Node.js app feature on shared hosting.
