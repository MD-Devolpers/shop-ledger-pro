import { Router, type IRouter } from "express";
import { eq, and, ilike, isNull, isNotNull } from "drizzle-orm";
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
    phone: c.phone ?? null,
    amount: parseFloat(c.amount),
    description: c.description,
    type: c.type,
    status: c.status,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/credits", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const qp = ListCreditsQueryParams.safeParse(req.query);

  const conditions = [eq(creditsTable.userId, userId)];

  const deleted = req.query.deleted === "true";
  if (deleted) {
    conditions.push(isNotNull(creditsTable.deletedAt));
  } else {
    conditions.push(isNull(creditsTable.deletedAt));
  }

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

  const { customerName, phone, amount, description, type, dueDate } = parsed.data;

  const [credit] = await db
    .insert(creditsTable)
    .values({
      userId,
      customerName,
      phone: phone ?? null,
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
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

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

// Soft delete — moves to recycle bin
router.delete("/credits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = UpdateCreditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db
    .update(creditsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(creditsTable.id, params.data.id), eq(creditsTable.userId, userId)));

  res.sendStatus(204);
});

// Restore a soft-deleted credit
router.post("/credits/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = UpdateCreditParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [credit] = await db
    .update(creditsTable)
    .set({ deletedAt: null })
    .where(and(eq(creditsTable.id, params.data.id), eq(creditsTable.userId, userId)))
    .returning();

  if (!credit) {
    res.status(404).json({ error: "Credit not found" });
    return;
  }

  res.json(formatCredit(credit));
});

// Permanently delete a credit
router.delete("/credits/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = UpdateCreditParams.safeParse(req.params);
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
