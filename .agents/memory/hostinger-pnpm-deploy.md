---
name: Hostinger/pnpm monorepo deploy
description: Fix for pnpm version mismatch errors when deploying a pnpm-workspace monorepo to Hostinger (or similar hosts) via corepack.
---

When a repo pins `packageManager: "pnpm@X.Y.Z"` in `package.json`, and the deploy host's corepack has a different pnpm version baked in that it can't switch away from, install fails with an error like:

> This project is configured to use X.Y.Z of pnpm. Your current pnpm is vA.B.C. Corepack invoked pnpm with this version, and pnpm does not switch versions when running under corepack.

**Tried and insufficient:** adding `manage-package-manager-versions=false` to `.npmrc`, and adding `devEngines.packageManager.onFail: "ignore"` to `package.json` — neither stopped the error, because the check that fails is corepack's own "invoked pnpm version != pinned packageManager version" guard, which fires *before* pnpm reads `.npmrc`/`devEngines` at all. Confirmed locally: invoking pnpm directly (not through corepack) never triggers this error even with a version mismatch — it's corepack-specific.

**Actual fix:** set the `packageManager` field (and mirror it in `devEngines.packageManager.version`) to the exact pnpm version corepack resolves to on the host (found in the build log's "Your current pnpm is vX.Y.Z" line), not the version used in the Replit dev environment. E.g. changed `packageManager` from `pnpm@10.26.1` to `pnpm@11.10.0` to match Hostinger's corepack-provided version.

**Why:** The host's corepack can't/won't download the pinned version (no network access or corepack download disabled), so it hard-fails instead of transparently switching. Aligning the pin to whatever version the host already has sidesteps the check entirely. This is safe for pnpm-lockfile-v9 projects — pnpm 11 read/installed from a v9 lockfile without issue in testing.

**How to apply:** Any time a user reports a pnpm "packageManager"/corepack version-mismatch error during deployment (Hostinger, or other non-Render/non-Replit hosts), read the exact host pnpm version from the error log and pin `packageManager` to that version instead of trying to bypass the check via config. This doesn't break the Replit dev environment since Replit invokes pnpm directly from `/nix/store`, not through corepack.

Also relevant for Hostinger specifically: Shared/Business hosting plans do not support long-running Node.js backend processes in the traditional sense combined with PostgreSQL — PostgreSQL is not available on shared hosting (MySQL only). A full Express+Postgres app generally needs Hostinger VPS/Cloud hosting, or an external managed Postgres (Neon/Supabase/Render) if using Hostinger's Node.js app feature on shared hosting.
