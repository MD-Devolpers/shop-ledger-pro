import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, count, isNotNull, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { entriesTable } from "@workspace/db";
import { creditsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [totalEntries] = await db.select({ count: count() }).from(entriesTable);
  const [totalCredits] = await db.select({ count: count() }).from(creditsTable);
  const [deletedEntries] = await db
    .select({ count: count() })
    .from(entriesTable)
    .where(isNotNull(entriesTable.deletedAt));

  res.json({
    totalUsers: totalUsers.count,
    totalEntries: totalEntries.count,
    totalCredits: totalCredits.count,
    deletedEntries: deletedEntries.count,
  });
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      emailVerified: usersTable.emailVerified,
      language: usersTable.language,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const entryCounts = await db
    .select({ userId: entriesTable.userId, count: count() })
    .from(entriesTable)
    .groupBy(entriesTable.userId);

  const creditCounts = await db
    .select({ userId: creditsTable.userId, count: count() })
    .from(creditsTable)
    .groupBy(creditsTable.userId);

  const entryMap = Object.fromEntries(entryCounts.map((e) => [e.userId, e.count]));
  const creditMap = Object.fromEntries(creditCounts.map((c) => [c.userId, c.count]));

  res.json(
    users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      entryCount: entryMap[u.id] ?? 0,
      creditCount: creditMap[u.id] ?? 0,
    }))
  );
});

// All soft-deleted entries across all users
router.get("/admin/deleted-entries", requireAdmin, async (req, res): Promise<void> => {
  const deleted = await db
    .select({
      id: entriesTable.id,
      userId: entriesTable.userId,
      username: usersTable.username,
      type: entriesTable.type,
      amount: entriesTable.amount,
      description: entriesTable.description,
      paymentMethod: entriesTable.paymentMethod,
      isCredit: entriesTable.isCredit,
      customerName: entriesTable.customerName,
      deletedAt: entriesTable.deletedAt,
      entryDate: entriesTable.entryDate,
    })
    .from(entriesTable)
    .leftJoin(usersTable, eq(entriesTable.userId, usersTable.id))
    .where(isNotNull(entriesTable.deletedAt))
    .orderBy(desc(entriesTable.deletedAt));

  res.json(
    deleted.map((e) => ({
      ...e,
      amount: parseFloat(e.amount),
      deletedAt: e.deletedAt?.toISOString(),
      entryDate: e.entryDate?.toISOString(),
    }))
  );
});

// Permanently delete a single entry (admin only)
router.delete("/admin/entries/:id/permanent", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);

  const [deleted] = await db
    .delete(entriesTable)
    .where(eq(entriesTable.id, id))
    .returning({ id: entriesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json({ message: "Entry permanently deleted", id: deleted.id });
});

// Permanently delete ALL soft-deleted entries (admin purge)
router.delete("/admin/entries/purge-deleted", requireAdmin, async (req, res): Promise<void> => {
  const deleted = await db
    .delete(entriesTable)
    .where(isNotNull(entriesTable.deletedAt))
    .returning({ id: entriesTable.id });

  res.json({ message: `Purged ${deleted.length} deleted entries`, count: deleted.length });
});

router.patch("/admin/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { role } = req.body;

  if (!["admin", "user"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (id === req.session?.userId && role !== "admin") {
    res.status(400).json({ error: "Cannot remove your own admin role" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(updated);
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);

  if (id === req.session?.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const [deleted] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, username: usersTable.username });

  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ message: `User ${deleted.username} deleted`, id: deleted.id });
});

// Admin: Send password reset email to a user
router.post("/admin/users/:id/reset-password", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (!user.email) { res.status(400).json({ error: "User has no email address" }); return; }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 3600 * 1000);

  await db.update(usersTable)
    .set({ resetToken: token, resetTokenExpiry: expiry })
    .where(eq(usersTable.id, id));

  const appUrl = `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers["x-forwarded-host"] || req.headers.host}`;

  let emailSent = false;
  try {
    const { sendPasswordResetEmail } = await import("../lib/mailer");
    emailSent = await sendPasswordResetEmail(user.email, user.username, token, appUrl);
  } catch (err) {}

  res.json({ message: emailSent ? `Reset email sent to ${user.email}` : "Token generated (email not configured)", emailSent });
});

// Admin: Change a user's email
router.patch("/admin/users/:id/email", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { email } = req.body;

  if (!email) { res.status(400).json({ error: "Email is required" }); return; }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) { res.status(400).json({ error: "Invalid email" }); return; }

  const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (taken && taken.id !== id) { res.status(409).json({ error: "Email already in use" }); return; }

  const [updated] = await db.update(usersTable)
    .set({ email, emailVerified: false, verificationToken: null, verificationTokenExpiry: null })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, username: usersTable.username, email: usersTable.email });

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...updated, message: "Email updated. User must re-verify." });
});

// Admin: Verify a user's email manually
router.patch("/admin/users/:id/verify-email", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [updated] = await db.update(usersTable)
    .set({ emailVerified: true, verificationToken: null, verificationTokenExpiry: null })
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id, username: usersTable.username });

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ...updated, message: "Email manually verified" });
});

export default router;

