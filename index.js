// Hostinger / LiteSpeed entry point
// Loads .env vars then launches the pre-built API server

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env file before importing the server (Hostinger doesn't inject env vars
// into Passenger apps automatically — we deploy a .env file via GitHub Actions)
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const content = readFileSync(join(__dir, ".env"), "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    // Only set if not already in environment
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env not present — rely on environment variables being injected externally
}

import("./artifacts/api-server/dist/index.mjs").catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
