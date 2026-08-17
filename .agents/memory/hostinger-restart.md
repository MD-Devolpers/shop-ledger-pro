---
name: Hostinger Node.js restart after deploy
description: How to restart the LiteSpeed Node.js app on Hostinger after deploying new dist files
---

## Rule
After deploying new dist files to Hostinger, the Node.js process must be restarted. The GitHub Actions workflow uses `touch tmp/restart.txt` + SIGUSR1, but this is unreliable. The user may need to restart manually.

## Why
LiteSpeed manages the Node.js process. `pkill -f lsnode` kills the process but LiteSpeed restarts it. However, if the app crashed multiple times before the fix, LiteSpeed may be in a backoff state.

## How to apply
Manual SSH restart (reliable):
```bash
pkill -f lsnode 2>/dev/null; pkill -f "node.*index" 2>/dev/null
sleep 15
curl -s -X POST https://shop-ledger.online/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"...","password":"..."}' | head -c 150
```

If still not working after pkill, the user must go to Hostinger hPanel → Node.js → Restart.

## Server details
- Host: shop-ledger.online, SSH port 65002, user: u412659001
- App dir: /home/u412659001/domains/shop-ledger.online/nodejs/
- Frontend: /home/u412659001/domains/shop-ledger.online/public_html/
- Entry: nodejs/index.js → imports ./artifacts/api-server/dist/index.mjs
