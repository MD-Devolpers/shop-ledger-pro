import { Router, type IRouter } from "express";
import { eq, and, gte, lte, isNull, isNotNull, desc, sql } from "drizzle-orm";
import { db, entriesTable, creditsTable } from "@workspace/db";
import {
  CreateEntryBody,
  UpdateEntryBody,
  GetEntryParams,
  UpdateEntryParams,
  DeleteEntryParams,
  RestoreEntryParams,
  UpdateEntryProfitParams,
  UpdateEntryProfitBody,
  ListEntriesQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatEntry(e: typeof entriesTable.$inferSelect) {
  return {
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
  };
}

router.get("/entries", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const qp = ListEntriesQueryParams.safeParse(req.query);

  const conditions = [eq(entriesTable.userId, userId)];

  const deleted = req.query.deleted === "true";
  if (deleted) {
    conditions.push(isNotNull(entriesTable.deletedAt));
  } else {
    conditions.push(isNull(entriesTable.deletedAt));
  }

  if (qp.success) {
    if (qp.data.type) {
      conditions.push(eq(entriesTable.type, qp.data.type));
    }
    if (qp.data.payment_method) {
      conditions.push(eq(entriesTable.paymentMethod, qp.data.payment_method));
    }
    if (qp.data.start_date) {
      conditions.push(gte(entriesTable.entryDate, new Date(qp.data.start_date)));
    }
    if (qp.data.end_date) {
      const endDate = new Date(qp.data.end_date);
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(entriesTable.entryDate, endDate));
    }
    if (qp.data.date) {
      const d = new Date(qp.data.date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      conditions.push(gte(entriesTable.entryDate, start));
      conditions.push(lte(entriesTable.entryDate, end));
    }
  }

  const entries = await db
    .select()
    .from(entriesTable)
    .where(and(...conditions))
    .orderBy(desc(entriesTable.entryDate));

  res.json(entries.map(formatEntry));
});

router.post("/entries", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const parsed = CreateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, amount, description, paymentMethod, isCredit, customerName, entryDate } = parsed.data;

  const [entry] = await db
    .insert(entriesTable)
    .values({
      userId,
      type,
      amount: amount.toString(),
      description: description ?? null,
      paymentMethod: paymentMethod ?? "cash",
      isCredit: isCredit ?? false,
      customerName: customerName ?? null,
      entryDate: entryDate ? new Date(entryDate) : new Date(),
    })
    .returning();

  // Auto-save to credits table when entry is marked as credit with a customer name
  if (isCredit && customerName) {
    // cash_in with credit = you gave goods on credit (customer owes you) → "given"
    // cash_out with credit = you got something on credit (you owe supplier) → "received"
    const creditType = type === "cash_in" ? "given" : "received";

    // Check if this customer already has a pending credit of the same type
    const [existingCredit] = await db
      .select()
      .from(creditsTable)
      .where(
        and(
          eq(creditsTable.userId, userId),
          eq(creditsTable.customerName, customerName),
          eq(creditsTable.type, creditType),
          eq(creditsTable.status, "pending")
        )
      )
      .limit(1);

    if (existingCredit) {
      // Add new amount to existing credit record
      const newAmount = parseFloat(existingCredit.amount) + amount;
      await db
        .update(creditsTable)
        .set({
          amount: newAmount.toString(),
          description: description
            ? `${existingCredit.description ? existingCredit.description + " | " : ""}${description}`
            : existingCredit.description,
        })
        .where(eq(creditsTable.id, existingCredit.id));
    } else {
      // Create a new credit record for this customer
      await db.insert(creditsTable).values({
        userId,
        customerName,
        amount: amount.toString(),
        description: description ?? null,
        type: creditType,
        status: "pending",
      });
    }
  }

  res.status(201).json(formatEntry(entry));
});

router.get("/entries/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = GetEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [entry] = await db
    .select()
    .from(entriesTable)
    .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId)));

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(formatEntry(entry));
});

router.patch("/entries/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = UpdateEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.paymentMethod !== undefined) updateData.paymentMethod = parsed.data.paymentMethod;
  if (parsed.data.isCredit !== undefined) updateData.isCredit = parsed.data.isCredit;
  if (parsed.data.customerName !== undefined) updateData.customerName = parsed.data.customerName;
  if (parsed.data.entryDate !== undefined) updateData.entryDate = new Date(parsed.data.entryDate as string);

  const [entry] = await db
    .update(entriesTable)
    .set(updateData)
    .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(formatEntry(entry));
});

router.delete("/entries/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = DeleteEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId), isNull(entriesTable.deletedAt)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(formatEntry(entry));
});

router.patch("/entries/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = RestoreEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set({ deletedAt: null })
    .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(formatEntry(entry));
});

router.patch("/entries/:id/profit", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = UpdateEntryProfitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateEntryProfitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db
    .update(entriesTable)
    .set({ profit: parsed.data.profit != null ? parsed.data.profit.toString() : null })
    .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(formatEntry(entry));
});

export default router;
