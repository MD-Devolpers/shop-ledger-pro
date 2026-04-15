import { Router, type IRouter } from "express";
import { eq, count, sum, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { entriesTable } from "@workspace/db";
import { creditsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/stats", requireAdmin, async (req, res): Promise<void> => {
  // Overall platform stats
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [totalEntries] = await db.select({ count: count() }).from(entriesTable);
  const [totalCredits] = await db.select({ count: count() }).from(creditsTable);

  res.json({
    totalUsers: totalUsers.count,
    totalEntries: totalEntries.count,
    totalCredits: totalCredits.count,
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

  // Get per-user entry counts and sums
  const entryCounts = await db
    .select({
      userId: entriesTable.userId,
      count: count(),
    })
    .from(entriesTable)
    .groupBy(entriesTable.userId);

  const creditCounts = await db
    .select({
      userId: creditsTable.userId,
      count: count(),
    })
    .from(creditsTable)
    .groupBy(creditsTable.userId);

  const entryMap = Object.fromEntries(entryCounts.map((e) => [e.userId, e.count]));
  const creditMap = Object.fromEntries(creditCounts.map((c) => [c.userId, c.count]));

  const result = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    entryCount: entryMap[u.id] ?? 0,
    creditCount: creditMap[u.id] ?? 0,
  }));

  res.json(result);
});

router.patch("/admin/users/:id/role", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { role } = req.body;

  if (!["admin", "user"].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'" });
    return;
  }

  // Prevent removing own admin role
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
    res.status(400).json({ error: "Cannot delete your own account from admin panel" });
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
