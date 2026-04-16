import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, creditsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const q = req.query.q as string | undefined;

  const baseWhere = q
    ? and(
        eq(creditsTable.userId, userId),
        eq(creditsTable.status, "pending"),
        ilike(creditsTable.customerName, `%${q}%`)
      )
    : and(eq(creditsTable.userId, userId), eq(creditsTable.status, "pending"));

  const customers = await db
    .select({
      id: sql<number>`min(${creditsTable.id})`.as("id"),
      name: creditsTable.customerName,
      totalCredit: sql<number>`sum(${creditsTable.amount})`.as("totalCredit"),
    })
    .from(creditsTable)
    .where(baseWhere)
    .groupBy(creditsTable.customerName);

  res.json(
    customers.map((c) => ({
      id: Number(c.id),
      name: c.name,
      totalCredit: parseFloat(String(c.totalCredit)),
    }))
  );
});

export default router;
