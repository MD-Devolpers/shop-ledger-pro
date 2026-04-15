import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, creditsTable } from "@workspace/db";
import {
  CreateCreditBody,
  UpdateCreditParams,
  UpdateCreditBody,
  DeleteCreditParams,
  ListCreditsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatCredit(c: typeof creditsTable.$inferSelect) {
  return {
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
  };
}

router.get("/credits", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const qp = ListCreditsQueryParams.safeParse(req.query);

  const conditions = [eq(creditsTable.userId, userId)];

  if (qp.success) {
    if (qp.data.customer_name) {
      conditions.push(ilike(creditsTable.customerName, `%${qp.data.customer_name}%`));
    }
    if (qp.data.status) {
      conditions.push(eq(creditsTable.status, qp.data.status));
    }
  }

  const credits = await db
    .select()
    .from(creditsTable)
    .where(and(...conditions))
    .orderBy(creditsTable.createdAt);

  res.json(credits.map(formatCredit));
});

router.post("/credits", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const parsed = CreateCreditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerName, amount, description, type, dueDate } = parsed.data;

  const [credit] = await db
    .insert(creditsTable)
    .values({
      userId,
      customerName,
      amount: amount.toString(),
      description: description ?? null,
      type,
      status: "pending",
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  res.status(201).json(formatCredit(credit));
});

router.patch("/credits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = UpdateCreditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateCreditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.dueDate !== undefined) updateData.dueDate = new Date(parsed.data.dueDate as string);

  const [credit] = await db
    .update(creditsTable)
    .set(updateData)
    .where(and(eq(creditsTable.id, params.data.id), eq(creditsTable.userId, userId)))
    .returning();

  if (!credit) {
    res.status(404).json({ error: "Credit not found" });
    return;
  }

  res.json(formatCredit(credit));
});

router.delete("/credits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = DeleteCreditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .delete(creditsTable)
    .where(and(eq(creditsTable.id, params.data.id), eq(creditsTable.userId, userId)));

  res.sendStatus(204);
});

export default router;
