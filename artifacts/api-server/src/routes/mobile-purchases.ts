import { Router, type IRouter } from "express";
import { eq, and, desc, ilike, or, isNull, inArray } from "drizzle-orm";
import { db, mobilePurchasesTable, entriesTable, creditsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function fmt(m: typeof mobilePurchasesTable.$inferSelect) {
  return {
    id: m.id,
    userId: m.userId,
    sellerName: m.sellerName,
    sellerPhone: m.sellerPhone ?? null,
    sellerAddress: m.sellerAddress ?? null,
    imei: m.imei ?? null,
    imei2: (m as any).imei2 ?? null,
    mobileModel: m.mobileModel,
    company: m.company,
    color: m.color ?? null,
    storageCapacity: m.storageCapacity ?? null,
    condition: m.condition,
    purchaseSource: (m as any).purchaseSource ?? "company",
    purchasePrice: parseFloat(m.purchasePrice as string),
    salePrice: parseFloat(m.salePrice as string),
    status: m.status,
    purchaseDate: m.purchaseDate.toISOString(),
    soldAt: m.soldAt ? m.soldAt.toISOString() : null,
    soldToName: m.soldToName ?? null,
    soldToPhone: m.soldToPhone ?? null,
    saleAmount: m.saleAmount ? parseFloat(m.saleAmount as string) : null,
    paymentMethod: m.paymentMethod ?? null,
    creditId: (m as any).creditId ?? null,
    notes: m.notes ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// List
router.get("/inventory/mobile-purchases", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { search, status } = req.query;

  const conditions: any[] = [eq(mobilePurchasesTable.userId, userId)];
  if (status) conditions.push(eq(mobilePurchasesTable.status, status as any));
  if (search) {
    conditions.push(
      or(
        ilike(mobilePurchasesTable.mobileModel, `%${search}%`),
        ilike(mobilePurchasesTable.company, `%${search}%`),
        ilike(mobilePurchasesTable.sellerName, `%${search}%`),
        ilike(mobilePurchasesTable.imei, `%${search}%`),
      )!
    );
  }

  const rows = await db
    .select()
    .from(mobilePurchasesTable)
    .where(and(...conditions))
    .orderBy(desc(mobilePurchasesTable.purchaseDate));

  res.json(rows.map(fmt));
});

// Get one
router.get("/inventory/mobile-purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const [row] = await db
    .select()
    .from(mobilePurchasesTable)
    .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(row));
});

// Create
router.post("/inventory/mobile-purchases", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const {
    sellerName, sellerPhone, sellerAddress,
    imei, mobileModel, company, color, storageCapacity, condition,
    purchasePrice, salePrice, notes, purchaseDate,
  } = req.body;

  if (!sellerName || !mobileModel || !company) {
    res.status(400).json({ error: "sellerName, mobileModel, company are required" });
    return;
  }

  const { imei2, purchaseSource, isCredit } = req.body;
  const pDate = purchaseDate ? new Date(purchaseDate) : new Date();
  const price = parseFloat(String(purchasePrice ?? 0)) || 0;

  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(mobilePurchasesTable).values({
      userId,
      purchaseSource: purchaseSource === "person" ? "person" : "company",
      sellerName,
      sellerPhone: sellerPhone || null,
      sellerAddress: sellerAddress || null,
      imei: imei || null,
      ...(imei2 ? { imei2: imei2 || null } : {}),
      mobileModel,
      company,
      color: color || null,
      storageCapacity: storageCapacity || null,
      condition: condition || "used",
      purchasePrice: String(purchasePrice ?? 0),
      salePrice: String(salePrice ?? 0),
      notes: notes || null,
      purchaseDate: pDate,
      status: "in_stock",
    }).returning();

    // Credit (udhaar) purchase: shop owes the seller/supplier → payable credit ("received").
    if (isCredit && price > 0) {
      const [credit] = await tx.insert(creditsTable).values({
        userId,
        customerName: sellerName,
        phone: sellerPhone || null,
        amount: String(price),
        description: `Mobile purchase on credit: ${company} ${mobileModel}${imei ? ` (IMEI: ${imei})` : ""}`,
        type: "received",
        status: "pending",
        dueDate: pDate,
      }).returning();
      const [linked] = await tx.update(mobilePurchasesTable)
        .set({ creditId: credit.id } as any)
        .where(eq(mobilePurchasesTable.id, created.id))
        .returning();
      return linked;
    }

    return created;
  });

  res.status(201).json(fmt(row));
});

// Update
router.put("/inventory/mobile-purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const {
    sellerName, sellerPhone, sellerAddress,
    imei, mobileModel, company, color, storageCapacity, condition,
    purchasePrice, salePrice, notes, purchaseDate,
  } = req.body;

  const { imei2, purchaseSource } = req.body;

  // Guard: accounting-affecting fields can't change on a sold mobile (its profit entry is already recorded)
  const [current] = await db.select().from(mobilePurchasesTable)
    .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.userId, userId)));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  if (current.status === "sold") {
    const priceChanged = purchasePrice !== undefined && parseFloat(String(purchasePrice)) !== parseFloat(current.purchasePrice as string);
    const sourceChanged = purchaseSource !== undefined && purchaseSource !== (current as any).purchaseSource;
    if (priceChanged || sourceChanged) {
      res.status(400).json({ error: "Mobile sold ho chuka hai — purchase price/source change karne se pehle 'Return to Stock' karein" });
      return;
    }
  }

  const update: any = {};
  if (purchaseSource !== undefined) update.purchaseSource = purchaseSource === "person" ? "person" : "company";
  if (sellerName !== undefined) update.sellerName = sellerName;
  if (sellerPhone !== undefined) update.sellerPhone = sellerPhone || null;
  if (sellerAddress !== undefined) update.sellerAddress = sellerAddress || null;
  if (imei !== undefined) update.imei = imei || null;
  if (imei2 !== undefined) update.imei2 = imei2 || null;
  if (mobileModel !== undefined) update.mobileModel = mobileModel;
  if (company !== undefined) update.company = company;
  if (color !== undefined) update.color = color || null;
  if (storageCapacity !== undefined) update.storageCapacity = storageCapacity || null;
  if (condition !== undefined) update.condition = condition;
  if (purchasePrice !== undefined) update.purchasePrice = String(purchasePrice);
  if (salePrice !== undefined) update.salePrice = String(salePrice);
  if (notes !== undefined) update.notes = notes || null;
  if (purchaseDate !== undefined) update.purchaseDate = new Date(purchaseDate);

  const oldPrice = parseFloat(current.purchasePrice as string) || 0;
  const newPrice = purchasePrice !== undefined ? (parseFloat(String(purchasePrice)) || 0) : oldPrice;
  const priceDelta = newPrice - oldPrice;
  const linkedCreditId = (current as any).creditId as number | null;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(mobilePurchasesTable)
      .set(update)
      .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.userId, userId)))
      .returning();
    if (!updated) return null;

    // Credit-purchased mobile: if the purchase price changed and the linked supplier credit is
    // still pending & untouched, keep the payable amount in sync.
    if (linkedCreditId && priceDelta !== 0) {
      const [credit] = await tx.select().from(creditsTable)
        .where(and(
          eq(creditsTable.id, linkedCreditId),
          eq(creditsTable.userId, userId),
          eq(creditsTable.status, "pending"),
          isNull(creditsTable.deletedAt),
        ));
      if (credit) {
        // Is this credit shared across multiple mobiles (bulk) or a single-purchase credit?
        const shared = await tx.select({ id: mobilePurchasesTable.id })
          .from(mobilePurchasesTable)
          .where(and(eq(mobilePurchasesTable.userId, userId), eq(mobilePurchasesTable.creditId, linkedCreditId)));
        const isShared = shared.length > 1;
        const creditAmount = parseFloat(credit.amount as string) || 0;
        if (isShared) {
          // Bulk-shared: adjust the shared credit by the price delta only.
          const next = Math.max(0, creditAmount + priceDelta);
          await tx.update(creditsTable).set({ amount: String(next) })
            .where(eq(creditsTable.id, linkedCreditId));
        } else if (Math.abs(creditAmount - oldPrice) < 0.005) {
          // Single-purchase & untouched (amount still equals the old price): set to new price.
          await tx.update(creditsTable).set({ amount: String(newPrice) })
            .where(eq(creditsTable.id, linkedCreditId));
        }
      }
    }

    return updated;
  });

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(row));
});

// Sell a mobile
router.post("/inventory/mobile-purchases/:id/sell", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { soldToName, soldToPhone, saleAmount, paymentMethod, saleDate, isCredit } = req.body;

  if (!saleAmount) { res.status(400).json({ error: "saleAmount is required" }); return; }
  const soldAt = saleDate ? new Date(saleDate) : new Date();

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(mobilePurchasesTable)
      .set({
        status: "sold",
        soldAt,
        soldToName: soldToName || null,
        soldToPhone: soldToPhone || null,
        saleAmount: String(saleAmount),
        paymentMethod: paymentMethod || "cash",
      })
      .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.userId, userId), eq(mobilePurchasesTable.status, "in_stock")))
      .returning();
    if (!updated) return null;

    // Company-sourced mobiles: profit counts in overall profits via a ledger entry.
    // Person-sourced (seller phone): profit stays only in Mobile Purchase reports.
    if (((updated as any).purchaseSource ?? "company") === "company") {
      const profit = parseFloat(String(saleAmount)) - parseFloat(updated.purchasePrice as string);
      const [entry] = await tx.insert(entriesTable).values({
        userId,
        type: "cash_in",
        amount: String(saleAmount),
        profit: String(profit),
        description: `Mobile Sale: ${updated.company} ${updated.mobileModel}${updated.imei ? ` (IMEI: ${updated.imei})` : ""}`,
        paymentMethod: (paymentMethod === "digital" ? "digital" : "cash") as "cash" | "digital",
        isCredit: Boolean(isCredit),
        customerName: soldToName || null,
        contactNumber: soldToPhone || null,
        source: "mobile_sale",
        entryDate: soldAt,
      }).returning();
      const [linked] = await tx.update(mobilePurchasesTable)
        .set({ entryId: entry.id } as any)
        .where(eq(mobilePurchasesTable.id, updated.id))
        .returning();
      return linked;
    }
    return updated;
  });

  if (!row) { res.status(404).json({ error: "Not found or already sold" }); return; }
  res.json(fmt(row));
});

// Return to stock
router.post("/inventory/mobile-purchases/:id/return-to-stock", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);

  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(mobilePurchasesTable)
      .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.userId, userId)))
      .for("update");
    if (!existing) return null;
    const prevEntryId = (existing as any).entryId as number | null;
    const [updated] = await tx
      .update(mobilePurchasesTable)
      .set({ status: "in_stock", soldAt: null, soldToName: null, soldToPhone: null, saleAmount: null, paymentMethod: null, entryId: null } as any)
      .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.status, "sold")))
      .returning();
    if (!updated) return existing; // already in stock — nothing to reverse
    // Remove the ledger entry created at sale time (soft delete → recycle bin)
    if (prevEntryId) {
      await tx.update(entriesTable).set({ deletedAt: new Date() })
        .where(and(eq(entriesTable.id, prevEntryId), eq(entriesTable.userId, userId)));
    }
    return updated;
  });

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(row));
});

// Bulk create
router.post("/inventory/mobile-purchases/bulk", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { items, purchaseDate } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items array required" }); return;
  }
  const validItems = items.filter((it: any) => it.sellerName?.trim() && it.mobileModel?.trim() && it.company?.trim());
  if (validItems.length === 0) {
    res.status(400).json({ error: "No valid items (sellerName, mobileModel, company required)" }); return;
  }
  const date = purchaseDate ? new Date(purchaseDate) : new Date();
  const { isCredit } = req.body;

  const inserted = await db.transaction(async (tx) => {
    const rows = await tx.insert(mobilePurchasesTable).values(
      validItems.map((it: any) => ({
        userId,
        purchaseSource: (it.purchaseSource === "person" ? "person" : "company") as "company" | "person",
        sellerName: it.sellerName.trim(),
        sellerPhone: it.sellerPhone || null,
        sellerAddress: it.sellerAddress || null,
        imei: it.imei || null,
        ...(it.imei2 ? { imei2: it.imei2 } : {}),
        mobileModel: it.mobileModel.trim(),
        company: it.company.trim(),
        color: it.color || null,
        storageCapacity: it.storageCapacity || null,
        condition: it.condition || "used",
        purchasePrice: String(it.purchasePrice ?? 0),
        salePrice: String(it.salePrice ?? 0),
        notes: it.notes || null,
        purchaseDate: it.purchaseDate ? new Date(it.purchaseDate) : date,
        status: "in_stock" as const,
      }))
    ).returning();

    // Credit (udhaar) purchase: one payable credit ("received") for the seller, total of all rows.
    // The same creditId is linked to every row so any of them can find/sync the shared credit.
    if (isCredit) {
      const total = validItems.reduce((s: number, it: any) => s + (parseFloat(String(it.purchasePrice ?? 0)) || 0), 0);
      if (total > 0) {
        const first = validItems[0];
        const [credit] = await tx.insert(creditsTable).values({
          userId,
          customerName: first.sellerName.trim(),
          phone: first.sellerPhone || null,
          amount: String(total),
          description: `Bulk mobile purchase (${rows.length} mobiles)`,
          type: "received",
          status: "pending",
          dueDate: date,
        }).returning();
        const ids = rows.map((r) => r.id);
        const linked = await tx.update(mobilePurchasesTable)
          .set({ creditId: credit.id } as any)
          .where(and(eq(mobilePurchasesTable.userId, userId), inArray(mobilePurchasesTable.id, ids)))
          .returning();
        return linked;
      }
    }

    return rows;
  });

  res.status(201).json({ count: inserted.length, items: inserted.map(fmt) });
});

// Delete
router.delete("/inventory/mobile-purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(mobilePurchasesTable)
      .where(and(eq(mobilePurchasesTable.id, id), eq(mobilePurchasesTable.userId, userId)))
      .returning();
    // If it was sold with a linked ledger entry, soft-delete that entry too (goes to recycle bin)
    const entryId = deleted ? ((deleted as any).entryId as number | null) : null;
    if (entryId) {
      await tx.update(entriesTable).set({ deletedAt: new Date() })
        .where(and(eq(entriesTable.id, entryId), eq(entriesTable.userId, userId)));
    }

    // Credit-purchased mobile: soft-delete the linked supplier credit if it's still pending
    // (untouched). If partially/fully paid we leave it as a settlement record.
    // For bulk-shared credits, only soft-delete once no other mobile still references it.
    const creditId = deleted ? ((deleted as any).creditId as number | null) : null;
    if (creditId) {
      const [siblings] = await tx.select({ id: mobilePurchasesTable.id })
        .from(mobilePurchasesTable)
        .where(and(eq(mobilePurchasesTable.userId, userId), eq(mobilePurchasesTable.creditId, creditId)))
        .limit(1);
      if (!siblings) {
        await tx.update(creditsTable).set({ deletedAt: new Date() })
          .where(and(
            eq(creditsTable.id, creditId),
            eq(creditsTable.userId, userId),
            eq(creditsTable.status, "pending"),
            isNull(creditsTable.deletedAt),
          ));
      }
    }
  });
  res.json({ success: true });
});

export default router;
