import { Router, type IRouter } from "express";
import { eq, and, gte, lte, isNull, isNotNull, desc, sql, inArray } from "drizzle-orm";
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
    isFundOperation: e.isFundOperation,
    customerName: e.customerName,
    contactNumber: e.contactNumber ?? null,
    source: e.source ?? null,
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
    if (qp.data.has_customer === true) {
      conditions.push(isNotNull(entriesTable.customerName));
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

  const { type, amount, description, paymentMethod, profit, isCredit, creditOwner, isFundOperation, customerName, contactNumber, entryDate } = parsed.data;

  const [entry] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(entriesTable)
      .values({
        userId,
        type,
        amount: amount.toString(),
        description: description ?? null,
        paymentMethod: paymentMethod ?? "cash",
        profit: profit != null ? profit.toString() : null,
        isCredit: isCredit ?? false,
        isFundOperation: isFundOperation ?? false,
        customerName: customerName ?? null,
        contactNumber: contactNumber ?? null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
      })
      .returning();

    if (isCredit && customerName) {
      // Manual credit is customer-owned by default. Supplier credit must always
      // be selected explicitly so a Cash Out loan cannot be misrouted.
      const creditType = creditOwner === "supplier" ? "received" : "given";
      await tx.insert(creditsTable).values({
        userId,
        customerName,
        amount: amount.toString(),
        description: description ?? null,
        entryId: created.id,
        type: creditType,
        status: "pending",
      });
    } else if (
      customerName &&
      (
        (type === "cash_in" && description?.startsWith("Payment received from ")) ||
        (type === "cash_out" && description?.startsWith("Payment to supplier "))
      )
    ) {
      const isCustomerPayment = type === "cash_in";
      await tx.insert(creditsTable).values({
        userId,
        customerName,
        amount: (-amount).toString(),
        description: `${isCustomerPayment ? "Customer" : "Supplier"} payment adjustment for entry #${created.id}`,
        entryId: created.id,
        type: isCustomerPayment ? "given" : "received",
        status: "pending",
      });
    }

    return [created] as const;
  });

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

router.delete("/entries/permanent-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const result = await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(entriesTable)
      .where(and(eq(entriesTable.userId, userId), isNotNull(entriesTable.deletedAt)))
      .returning({ id: entriesTable.id });
    if (deleted.length > 0) {
      await tx
        .delete(creditsTable)
        .where(and(eq(creditsTable.userId, userId), inArray(creditsTable.entryId, deleted.map(entry => entry.id))));
    }
    return deleted;
  });
  res.json({ message: "All deleted permanently", count: result.length });
});

router.delete("/entries/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = DeleteEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const entry = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(entriesTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId), isNull(entriesTable.deletedAt)))
      .returning();
    if (!deleted) return null;
    await tx
      .update(creditsTable)
      .set({ deletedAt: new Date() })
      .where(and(eq(creditsTable.userId, userId), eq(creditsTable.entryId, deleted.id), isNull(creditsTable.deletedAt)));
    return deleted;
  });

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  res.json(formatEntry(entry));
});

router.delete("/entries/:id/permanent", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(entriesTable)
      .where(and(eq(entriesTable.id, id), eq(entriesTable.userId, userId), isNotNull(entriesTable.deletedAt)))
      .returning({ id: entriesTable.id });
    if (!removed) return null;
    await tx
      .delete(creditsTable)
      .where(and(eq(creditsTable.userId, userId), eq(creditsTable.entryId, id)));
    return removed;
  });

  if (!deleted) {
    res.status(404).json({ error: "Entry not found or not deleted" });
    return;
  }

  res.json({ message: "Permanently deleted", id: deleted.id });
});

router.patch("/entries/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const params = RestoreEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const entry = await db.transaction(async (tx) => {
    const [restored] = await tx
      .update(entriesTable)
      .set({ deletedAt: null })
      .where(and(eq(entriesTable.id, params.data.id), eq(entriesTable.userId, userId)))
      .returning();
    if (!restored) return null;
    await tx
      .update(creditsTable)
      .set({ deletedAt: null })
      .where(and(eq(creditsTable.userId, userId), eq(creditsTable.entryId, restored.id)));
    return restored;
  });

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
