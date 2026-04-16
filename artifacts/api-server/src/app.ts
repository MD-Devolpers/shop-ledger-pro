import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

declare module "express" {
  interface Request {
    session: { userId?: number } | null;
  }
}

const app: Express = express();

// Trust the first proxy (Render, Railway, etc.) so req.secure works correctly
// and cookie-session saves the session over HTTPS connections
app.set("trust proxy", 1);

// ── Security headers (helmet) ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow Vite in dev; tighten in prod if needed
    crossOriginEmbedderPolicy: false,
  })
);

// Remove X-Powered-By header
app.disable("x-powered-by");

// ── Logging ────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Strip query params from logged URLs to avoid leaking tokens
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Session ────────────────────────────────────────────────────────────────
app.use(
  cookieSession({
    name: "session",
    secret: process.env.SESSION_SECRET || "ledgerentries-change-in-production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  })
);

// ── Rate limiting ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: { error: "Rate limit exceeded. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
});

// Apply strict rate limit to auth routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

// Apply general rate limit to all API routes
app.use("/api", apiLimiter);

// ── Digital Asset Links (required for Play Store TWA) ─────────────────────
app.get("/.well-known/assetlinks.json", (_req: Request, res: Response) => {
  const raw = process.env.ASSET_LINKS_JSON;
  if (raw) {
    try {
      res.json(JSON.parse(raw));
    } catch {
      res.status(500).json({ error: "Invalid ASSET_LINKS_JSON env var" });
    }
  } else {
    res.json([]);
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Serve frontend static files in production ──────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "public");

if (process.env.NODE_ENV === "production") {
  const indexHtml = path.resolve(publicDir, "index.html");
  const publicExists = existsSync(publicDir);
  const indexExists = existsSync(indexHtml);
  logger.info({ publicDir, publicExists, indexExists }, "Static files check");

  app.use(express.static(publicDir, { index: false }));
  app.use("/{*splat}", (_req: Request, res: Response) => {
    if (indexExists) {
      res.sendFile(indexHtml);
    } else {
      res.status(503).send("Frontend not built. Please redeploy.");
    }
  });
} else {
  // ── 404 handler (dev only) ──────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });
}

// ── Global error handler (hides internal details) ──────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  // Never expose stack traces or file paths in responses
  res.status(500).json({ error: "An internal error occurred. Please try again." });
});

export default app;
