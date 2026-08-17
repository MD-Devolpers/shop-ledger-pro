/**
 * Inventory PIN Security API
 * Each user manages their own 4-digit PIN to protect selected inventory pages.
 *
 * Endpoints:
 *   GET    /api/inventory/pin-settings        — fetch settings (protected pages, unlock duration, pinSet)
 *   PUT    /api/inventory/pin-settings        — update protected pages and/or unlockDuration
 *   POST   /api/inventory/pin-set             — set PIN for the first time (no current PIN needed)
 *   POST   /api/inventory/pin-change          — change PIN (requires currentPin + newPin)
 *   DELETE /api/inventory/pin-settings/pin    — remove PIN (requires current PIN)
 *   POST   /api/inventory/pin-verify          — verify PIN to unlock (returns success)
 *   POST   /api/inventory/pin-reset-request   — send OTP to registered email
 *   POST   /api/inventory/pin-reset-verify    — verify OTP + set new PIN
 */
import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, inventoryPinSettingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { emailConfigured } from "../lib/mailer";
import nodemailer from "nodemailer";

const router: IRouter = Router();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const transporter = (GMAIL_USER && GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
  : null;

async function sendPinResetEmail(to: string, username: string, otp: string): Promise<boolean> {
  if (!transporter) {
    console.log(`[PIN-RESET] Email not configured. OTP for ${username}: ${otp}`);
    return false;
  }
  const body = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;padding:24px;">
      <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <div style="background:#0d7e6a;padding:24px;text-align:center;">
          <div style="color:white;font-size:20px;font-weight:700;">📒 LedgerEntries</div>
          <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:2px;">Inventory PIN Reset</div>
        </div>
        <div style="padding:28px 32px;">
          <h2 style="color:#111;font-size:20px;margin:0 0 8px;">Hello, ${username}!</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 20px;">
            We received a request to reset your Inventory PIN. Use the code below to set a new PIN.
          </p>
          <div style="text-align:center;margin:0 0 24px;">
            <div style="display:inline-block;background:#f0fdf9;border:2px solid #0d7e6a;border-radius:12px;padding:16px 40px;">
              <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#0d7e6a;">${otp}</div>
              <div style="font-size:11px;color:#666;margin-top:6px;">6-digit verification code</div>
            </div>
          </div>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
            <p style="color:#9a3412;font-size:13px;margin:0;">
              <strong>This code expires in 15 minutes.</strong> If you didn't request a PIN reset, your account is safe — just ignore this email.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
  await transporter.sendMail({
    from: `"LedgerEntries" <${GMAIL_USER}>`,
    to,
    subject: "🔐 Inventory PIN Reset Code — LedgerEntries",
    html: body,
  });
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getOrNull(userId: number) {
  const [row] = await db
    .select()
    .from(inventoryPinSettingsTable)
    .where(eq(inventoryPinSettingsTable.userId, userId));
  return row ?? null;
}

// ── GET /api/inventory/pin-settings ──────────────────────────────────────────

router.get("/inventory/pin-settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const row = await getOrNull(userId);
  res.json({
    pinSet: !!row?.pinHash,
    protectedPages: row ? JSON.parse(row.protectedPages) : [],
    unlockDuration: row?.unlockDuration ?? 10,
  });
});

// ── PUT /api/inventory/pin-settings — update pages + duration ────────────────

router.put("/inventory/pin-settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { protectedPages, unlockDuration } = req.body;

  if (protectedPages !== undefined && !Array.isArray(protectedPages)) {
    res.status(400).json({ error: "protectedPages must be an array" });
    return;
  }
  if (unlockDuration !== undefined && (typeof unlockDuration !== "number" || unlockDuration < 1 || unlockDuration > 480)) {
    res.status(400).json({ error: "unlockDuration must be 1–480 minutes" });
    return;
  }

  const existing = await getOrNull(userId);

  const newPages = protectedPages !== undefined ? JSON.stringify(protectedPages) : (existing?.protectedPages ?? "[]");
  const newDuration = unlockDuration ?? existing?.unlockDuration ?? 10;

  if (existing) {
    await db.update(inventoryPinSettingsTable)
      .set({ protectedPages: newPages, unlockDuration: newDuration })
      .where(eq(inventoryPinSettingsTable.userId, userId));
  } else {
    await db.insert(inventoryPinSettingsTable)
      .values({ userId, protectedPages: newPages, unlockDuration: newDuration });
  }

  res.json({ success: true, protectedPages: JSON.parse(newPages), unlockDuration: newDuration });
});

// ── POST /api/inventory/pin-set — set PIN for the first time ─────────────────

router.post("/inventory/pin-set", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { pin } = req.body;

  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" });
    return;
  }

  const existing = await getOrNull(userId);

  if (existing?.pinHash) {
    res.status(400).json({ error: "PIN is already set. Use change-pin to update it." });
    return;
  }

  const pinHash = await bcrypt.hash(pin, 10);

  if (existing) {
    await db.update(inventoryPinSettingsTable)
      .set({ pinHash })
      .where(eq(inventoryPinSettingsTable.userId, userId));
  } else {
    await db.insert(inventoryPinSettingsTable)
      .values({ userId, pinHash, protectedPages: "[]", unlockDuration: 10 });
  }

  res.json({ success: true, pinSet: true });
});

// ── POST /api/inventory/pin-change — change PIN (requires currentPin) ─────────

router.post("/inventory/pin-change", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { currentPin, newPin } = req.body;

  if (typeof currentPin !== "string" || !/^\d{4}$/.test(currentPin)) {
    res.status(400).json({ error: "Current PIN must be 4 digits" });
    return;
  }
  if (typeof newPin !== "string" || !/^\d{4}$/.test(newPin)) {
    res.status(400).json({ error: "New PIN must be 4 digits" });
    return;
  }

  const existing = await getOrNull(userId);
  if (!existing?.pinHash) {
    res.status(400).json({ error: "No PIN set. Use set-pin first." });
    return;
  }

  const match = await bcrypt.compare(currentPin, existing.pinHash);
  if (!match) {
    res.status(401).json({ error: "Current PIN is incorrect" });
    return;
  }

  const newPinHash = await bcrypt.hash(newPin, 10);
  await db.update(inventoryPinSettingsTable)
    .set({ pinHash: newPinHash })
    .where(eq(inventoryPinSettingsTable.userId, userId));

  res.json({ success: true });
});

// ── DELETE /api/inventory/pin-settings/pin — remove PIN ──────────────────────

router.delete("/inventory/pin-settings/pin", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { currentPin } = req.body;

  const existing = await getOrNull(userId);
  if (!existing?.pinHash) {
    // No PIN set — nothing to remove
    res.json({ success: true, pinSet: false });
    return;
  }

  if (typeof currentPin !== "string" || !/^\d{4}$/.test(currentPin)) {
    res.status(400).json({ error: "Current PIN required to remove PIN" });
    return;
  }

  const match = await bcrypt.compare(currentPin, existing.pinHash);
  if (!match) {
    res.status(401).json({ error: "Current PIN is incorrect" });
    return;
  }

  await db.update(inventoryPinSettingsTable)
    .set({ pinHash: null })
    .where(eq(inventoryPinSettingsTable.userId, userId));

  res.json({ success: true, pinSet: false });
});

// ── POST /api/inventory/pin-verify — unlock pages ────────────────────────────

router.post("/inventory/pin-verify", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { pin } = req.body;

  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "Enter 4-digit PIN" });
    return;
  }

  const row = await getOrNull(userId);

  if (!row?.pinHash) {
    res.json({ success: true }); // No PIN set — open
    return;
  }

  const match = await bcrypt.compare(pin, row.pinHash);
  if (!match) {
    res.status(401).json({ error: "Incorrect PIN" });
    return;
  }

  res.json({ success: true });
});

// ── POST /api/inventory/pin-reset-request — send OTP to email ────────────────

router.post("/inventory/pin-reset-request", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const [user] = await db.select({ email: usersTable.email, username: usersTable.username, emailVerified: usersTable.emailVerified })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user?.email) {
    res.status(400).json({ error: "No email address on file. Add an email in Settings first." });
    return;
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const existing = await getOrNull(userId);
  if (existing) {
    await db.update(inventoryPinSettingsTable)
      .set({ pinResetToken: otp, pinResetTokenExpiry: expiry })
      .where(eq(inventoryPinSettingsTable.userId, userId));
  } else {
    await db.insert(inventoryPinSettingsTable)
      .values({ userId, protectedPages: "[]", unlockDuration: 10, pinResetToken: otp, pinResetTokenExpiry: expiry });
  }

  const sent = await sendPinResetEmail(user.email, user.username, otp);

  if (sent) {
    res.json({ success: true, message: `Verification code sent to ${user.email}` });
  } else {
    // Email not configured — return code in dev for testing
    res.json({ success: true, message: "Code sent (check server logs if email not configured)", _devCode: process.env.NODE_ENV !== "production" ? otp : undefined });
  }
});

// ── POST /api/inventory/pin-reset-verify — verify OTP + set new PIN ──────────

router.post("/inventory/pin-reset-verify", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { otp, newPin } = req.body;

  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ error: "Enter the 6-digit verification code" });
    return;
  }
  if (typeof newPin !== "string" || !/^\d{4}$/.test(newPin)) {
    res.status(400).json({ error: "New PIN must be exactly 4 digits" });
    return;
  }

  const row = await getOrNull(userId);

  if (!row?.pinResetToken || !row?.pinResetTokenExpiry) {
    res.status(400).json({ error: "No reset code found. Please request a new one." });
    return;
  }

  if (new Date() > row.pinResetTokenExpiry) {
    res.status(400).json({ error: "Verification code expired. Please request a new one." });
    return;
  }

  if (row.pinResetToken !== otp) {
    res.status(401).json({ error: "Incorrect verification code" });
    return;
  }

  const newPinHash = await bcrypt.hash(newPin, 10);
  await db.update(inventoryPinSettingsTable)
    .set({ pinHash: newPinHash, pinResetToken: null, pinResetTokenExpiry: null })
    .where(eq(inventoryPinSettingsTable.userId, userId));

  res.json({ success: true, message: "PIN has been reset successfully" });
});

export default router;
