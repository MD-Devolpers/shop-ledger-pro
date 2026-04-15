import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, entriesTable, creditsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/backup/export", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  const entries = await db
    .select()
    .from(entriesTable)
    .where(eq(entriesTable.userId, userId))
    .orderBy(entriesTable.entryDate);

  const credits = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.userId, userId))
    .orderBy(creditsTable.createdAt);

  res.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      language: user.language,
      createdAt: user.createdAt.toISOString(),
    },
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      type: e.type,
      amount: parseFloat(e.amount),
      description: e.description,
      paymentMethod: e.paymentMethod,
      profit: e.profit != null ? parseFloat(e.profit) : null,
      isCredit: e.isCredit,
      customerName: e.customerName,
      deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
      entryDate: e.entryDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    credits: credits.map((c) => ({
      id: c.id,
      userId: c.userId,
      customerName: c.customerName,
      amount: parseFloat(c.amount),
      description: c.description,
      type: c.type,
      status: c.status,
      dueDate: c.dueDate ? c.dueDate.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
});

export default router;
