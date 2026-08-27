import { Router, type IRouter } from "express";
import { eq, and, ilike, isNull } from "drizzle-orm";
import { db, creditsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const q = req.query.q as string | undefined;

  const baseWhere = q
    ? and(
        eq(creditsTable.userId, userId),
        isNull(creditsTable.deletedAt),
        eq(creditsTable.status, "pending"),
        eq(creditsTable.type, "given"),
        ilike(creditsTable.customerName, `%${q}%`)
      )
    : and(
        eq(creditsTable.userId, userId),
        isNull(creditsTable.deletedAt),
        eq(creditsTable.status, "pending"),
        eq(creditsTable.type, "given")
      );

  const creditRows = await db
    .select({
      id: creditsTable.id,
      name: creditsTable.customerName,
      amount: creditsTable.amount,
    })
    .from(creditsTable)
    .where(baseWhere);

  // Match the Credits page: merge names that differ only by case or spacing
  // and calculate the outstanding balance from all active pending adjustments.
  const customerMap = new Map<string, { id: number; name: string; totalCredit: number }>();
  for (const row of creditRows) {
    const name = row.name.trim();
    const key = name.toLocaleLowerCase();
    const existing = customerMap.get(key);
    if (existing) {
      existing.totalCredit += parseFloat(row.amount);
    } else {
      customerMap.set(key, {
        id: row.id,
        name,
        totalCredit: parseFloat(row.amount),
      });
    }
  }

  res.json(
    [...customerMap.values()]
      .map((c) => ({
        id: c.id,
        name: c.name,
        totalCredit: Math.max(0, c.totalCredit),
      }))
      .filter((c) => c.totalCredit > 0)
  );
});

export default router;
