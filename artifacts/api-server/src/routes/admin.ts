import { Router, type IRouter } from "express";
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

export default router;
