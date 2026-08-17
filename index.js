// Hostinger / LiteSpeed entry point
// Launches the pre-built API server (artifacts/api-server/dist/index.mjs)
// which also serves the React frontend from artifacts/shop-ledger/dist/public

import("./artifacts/api-server/dist/index.mjs").catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
