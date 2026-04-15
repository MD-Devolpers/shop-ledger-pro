import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

// Tell the frontend if Google OAuth is available
router.get("/auth/google/status", (_req, res) => {
  res.json({ available: googleConfigured });
});

function getAppUrl(req: import("express").Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Step 1: Redirect user to Google's OAuth consent screen
router.get("/auth/google", (req, res) => {
  if (!googleConfigured) {
    res.status(503).json({ error: "Google OAuth is not configured" });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  // Store state in session for CSRF protection
  req.session = { ...req.session, oauthState: state };

  const redirectUri = `${getAppUrl(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email profile openid",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: Handle Google's callback
router.get("/auth/google/callback", async (req, res): Promise<void> => {
  if (!googleConfigured) {
    res.redirect("/login?error=oauth_not_configured");
    return;
  }

  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`/login?error=${encodeURIComponent(error)}`);
    return;
  }

  // CSRF check
  const savedState = (req.session as Record<string, unknown>)?.oauthState as string | undefined;
  if (req.session) {
    (req.session as Record<string, unknown>).oauthState = undefined;
  }

  if (!state || state !== savedState) {
    res.redirect("/login?error=invalid_state");
    return;
  }

  if (!code) {
    res.redirect("/login?error=no_code");
    return;
  }

  try {
    const redirectUri = `${getAppUrl(req)}/api/auth/google/callback`;

    // Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      req.log?.warn({ errBody }, "Google token exchange failed");
      res.redirect("/login?error=token_exchange_failed");
      return;
    }

    const tokens = await tokenRes.json() as { access_token: string };

    // Fetch user profile from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      res.redirect("/login?error=userinfo_failed");
      return;
    }

    const googleUser = await userInfoRes.json() as {
      id: string;
      email: string;
      name: string;
      given_name?: string;
    };

    if (!googleUser.email) {
      res.redirect("/login?error=no_email");
      return;
    }

    // 1. Already linked by googleId → log in
    const [existingByGoogle] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, googleUser.id));

    if (existingByGoogle) {
      req.session = { userId: existingByGoogle.id };
      res.redirect("/app");
      return;
    }

    // 2. Same email already registered → link & log in
    const [existingByEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, googleUser.email));

    if (existingByEmail) {
      await db
        .update(usersTable)
        .set({ googleId: googleUser.id, emailVerified: true })
        .where(eq(usersTable.id, existingByEmail.id));

      req.session = { userId: existingByEmail.id };
      res.redirect("/app");
      return;
    }

    // 3. Brand-new user — create account
    const emailPrefix = googleUser.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
    let username = emailPrefix || "user";

    // Ensure username uniqueness
    const [taken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));

    if (taken) {
      username = `${username}${crypto.randomInt(1000, 9999)}`;
    }

    const ADMIN_EMAIL = "mobiledoctor4747@gmail.com";
    const isAdmin = googleUser.email === ADMIN_EMAIL;

    const [{ count: userCount }] = await db
      .select({ count: count() })
      .from(usersTable);
    const isFirst = Number(userCount) === 0;

    const [newUser] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash: null,
        googleId: googleUser.id,
        email: googleUser.email,
        emailVerified: true,
        role: isAdmin || isFirst ? "admin" : "user",
        language: "en",
      })
      .returning();

    req.session = { userId: newUser.id };
    res.redirect("/app");
  } catch (err) {
    req.log?.error({ err }, "Google OAuth error");
    res.redirect("/login?error=server_error");
  }
});

export default router;
