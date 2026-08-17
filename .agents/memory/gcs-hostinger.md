---
name: Google Cloud Storage on Hostinger
description: How to handle @google-cloud/storage in esbuild bundle when deploying to Hostinger
---

## Rule
`@google-cloud/storage` must be in the esbuild `external` list in `build.mjs` AND loaded via `await import('@google-cloud/storage')` inside an async function (never a static top-level import, never `createRequire`).

## Why
- The package uses `.proto` files loaded at runtime — esbuild cannot bundle it
- `createRequire` inside an ESM bundle still causes `ModuleJob._link` at startup on Node.js v22, crashing the server
- Dynamic `import()` with the package in externals generates a true deferred ESM import — only runs when the function is called, not at startup
- On Hostinger (no `@google-cloud/storage` installed), the try/catch around the dynamic import catches the error gracefully and returns a 503

## How to apply
1. `build.mjs` externals list must include `"@google-cloud/storage"` and `"@google-cloud/*"`
2. Any file using the package must use: `const { Storage } = await import('@google-cloud/storage')` inside an async function wrapped in try/catch
3. The same pattern applies to `bill-attachments.ts` and `objectStorage.ts`
