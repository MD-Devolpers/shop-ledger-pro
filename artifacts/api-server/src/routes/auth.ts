import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import {
  SignupBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import { sendVerificationEmail, sendPasswordResetEmail, emailConfigured } from "../lib/mailer";

const router: IRouter = Router();

function getAppUrl(req: import("express").Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email, language } = parsed.data;

  // Email is compulsory — all accounts must verify
  if (!email) {
    res.status(400).json({ error: "Email is required. Email verification is compulsory." });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existing.length > 0) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  if (email) {
    const emailExists = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    if (emailExists.length > 0) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // First user ever OR designated admin email gets admin role
  const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
  const isFirstUser = allUsers.length === 0;
  const isDesignatedAdmin = email === "mobiledoctor4747@gmail.com";

  // Generate verification token if email provided
  const verificationToken = email ? crypto.randomBytes(32).toString("hex") : null;
  const verificationTokenExpiry = email ? new Date(Date.now() + 24 * 3600 * 1000) : null;

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      email: email ?? null,
      language: language ?? "en",
      role: isFirstUser || isDesignatedAdmin ? "admin" : "user",
      emailVerified: !email, // verified if no email provided
      verificationToken,
      verificationTokenExpiry,
    })
    .returning();

  // Send verification email
  let emailSent = false;
  if (email && verificationToken) {
    try {
      emailSent = await sendVerificationEmail(email, username, verificationToken, getAppUrl(req));
    } catch (err) {
      req.log.warn({ err }, "Failed to send verification email");
    }
  }

  req.session = { userId: user.id };

  res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      language: user.language,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    },
    emailSent,
    emailConfigured,
    message: email
      ? emailSent
        ? "Account created! Please check your email to verify your account."
        : "Account created! Email verification is not configured yet."
      : "Account created successfully",
  });
});

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Verification token is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.verificationToken, token));

  if (!user) {
    res.status(400).json({ error: "Invalid verification token" });
    return;
  }

  if (user.emailVerified) {
    res.json({ message: "Email already verified", alreadyVerified: true });
    return;
  }

  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    res.status(400).json({ error: "Verification token has expired. Please request a new one." });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, verificationToken: null, verificationTokenExpiry: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Email verified successfully!", username: user.username });
});

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.emailVerified) {
    res.status(400).json({ error: "Email already verified" });
    return;
  }

  if (!user.email) {
    res.status(400).json({ error: "No email address on file" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 24 * 3600 * 1000);

  await db
    .update(usersTable)
    .set({ verificationToken: token, verificationTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  let emailSent = false;
  try {
    emailSent = await sendVerificationEmail(user.email, user.username, token, getAppUrl(req));
  } catch (err) {
    req.log.warn({ err }, "Failed to resend verification email");
  }

  res.json({ message: emailSent ? "Verification email sent" : "Email not configured", emailSent });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session = { userId: user.id };

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      language: user.language,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    },
    message: "Login successful",
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session = null;
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    language: user.language,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) {
    res.status(404).json({ error: "No account found with that email" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 3600 * 1000);

  await db
    .update(usersTable)
    .set({ resetToken: token, resetTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  let emailSent = false;
  try {
    emailSent = await sendPasswordResetEmail(email, user.username, token, getAppUrl(req));
  } catch (err) {
    req.log.warn({ err }, "Failed to send password reset email");
  }

  req.log.info({ userId: user.id }, "Password reset token generated");

  res.json({
    message: emailSent
      ? "Password reset email sent. Please check your inbox."
      : "Reset token generated (email not configured). Check server logs.",
    emailSent,
    // In dev without email, expose token so it can be used
    ...(process.env.NODE_ENV === "development" && !emailSent ? { devToken: token } : {}),
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, newPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.resetToken, token));

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password reset successfully" });
});

export default router;
