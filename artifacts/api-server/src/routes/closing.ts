import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, closingsTable } from "@workspace/db";
import { eq, desc, sum, and } from "drizzle-orm";

const router = Router();

// GET /api/closing - list all closings and personal wallet total
router.get("/api/closing", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;

  const history = await db
    .select()
    .from(closingsTable)
    .where(eq(closingsTable.userId, userId))
    .orderBy(desc(closingsTable.createdAt));

  const totals = await db
    .select({
      source: closingsTable.source,
      total: sum(closingsTable.amount),
    })
    .from(closingsTable)
    .where(eq(closingsTable.userId, userId))
    .groupBy(closingsTable.source);

  let cashWithdrawn = 0;
  let digitalWithdrawn = 0;
  for (const t of totals) {
    if (t.source === "cash") cashWithdrawn = parseFloat(t.total ?? "0");
    if (t.source === "digital") digitalWithdrawn = parseFloat(t.total ?? "0");
  }

  res.json({
    history: history.map((c) => ({
      id: c.id,
      amount: parseFloat(c.amount),
      source: c.source,
      note: c.note,
      createdAt: c.createdAt,
    })),
    personalWallet: Math.round((cashWithdrawn + digitalWithdrawn) * 100) / 100,
    cashWithdrawn: Math.round(cashWithdrawn * 100) / 100,
    digitalWithdrawn: Math.round(digitalWithdrawn * 100) / 100,
  });
});

// POST /api/closing - create a closing (move to personal wallet)
router.post("/api/closing", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;

  const { amount, source, note } = req.body;
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (!["cash", "digital"].includes(source)) {
    return res.status(400).json({ error: "Source must be cash or digital" });
  }

  const [closing] = await db
    .insert(closingsTable)
    .values({ userId, amount: amount.toString(), source, note })
    .returning();

  res.status(201).json({
    id: closing.id,
    amount: parseFloat(closing.amount),
    source: closing.source,
    note: closing.note,
    createdAt: closing.createdAt,
  });
});

// DELETE /api/closing/:id - delete a closing entry
router.delete("/api/closing/:id", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId as number;
  const id = parseInt(req.params.id);

  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await db
    .delete(closingsTable)
    .where(and(eq(closingsTable.id, id), eq(closingsTable.userId, userId)));

  res.json({ message: "Closing deleted" });
});

export default router;
