import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  db,
  companyReplacementsTable,
  replacementReceivesTable,
  productsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function fmtRepl(r: any, receives: any[] = []) {
  const sentQty = parseFloat(r.sentQty);
  const receivedQty = parseFloat(r.receivedQty);
  return {
    id: r.id,
    userId: r.userId,
    productId: r.productId,
    productName: r.productName ?? null,
    productCode: r.productCode ?? null,
    companyId: r.companyId,
    companyName: r.companyName,
    sentQty,
    receivedQty,
    pendingQty: Math.max(0, sentQty - receivedQty),
    dateSent: r.dateSent instanceof Date ? r.dateSent.toISOString() : r.dateSent,
    faultReason: r.faultReason,
    customerName: r.customerName ?? null,
    referenceNo: r.referenceNo ?? null,
    status: r.status,
    notes: r.notes ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    receives: receives.map((recv) => ({
      id: recv.id,
      receivedQty: parseFloat(recv.receivedQty),
      receiveDate: recv.receiveDate instanceof Date ? recv.receiveDate.toISOString() : recv.receiveDate,
      notes: recv.notes ?? null,
      createdAt: recv.createdAt instanceof Date ? recv.createdAt.toISOString() : recv.createdAt,
    })),
  };
}

// List replacements
router.get("/inventory/company-replacements", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { companyId, status, dateFrom, dateTo } = req.query;

  const conditions: any[] = [eq(companyReplacementsTable.userId, userId)];
  if (companyId) conditions.push(eq(companyReplacementsTable.companyId, parseInt(companyId as string)));
  if (status && status !== "all") conditions.push(eq(companyReplacementsTable.status, status as any));
  if (dateFrom) conditions.push(gte(companyReplacementsTable.dateSent, new Date(dateFrom as string)));
  if (dateTo) {
    const end = new Date(dateTo as string);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(companyReplacementsTable.dateSent, end));
  }

  const rows = await db
    .select({
      r: companyReplacementsTable,
      productName: productsTable.name,
      productCode: productsTable.code,
    })
    .from(companyReplacementsTable)
    .leftJoin(productsTable, eq(companyReplacementsTable.productId, productsTable.id))
    .where(and(...conditions))
    .orderBy(desc(companyReplacementsTable.dateSent));

  res.json(rows.map((row) => fmtRepl({ ...row.r, productName: row.productName, productCode: row.productCode })));
});

// Get single with receive history
router.get("/inventory/company-replacements/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);

  const rows = await db
    .select({
      r: companyReplacementsTable,
      productName: productsTable.name,
      productCode: productsTable.code,
    })
    .from(companyReplacementsTable)
    .leftJoin(productsTable, eq(companyReplacementsTable.productId, productsTable.id))
    .where(and(eq(companyReplacementsTable.id, id), eq(companyReplacementsTable.userId, userId)));

  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }

  const receives = await db
    .select()
    .from(replacementReceivesTable)
    .where(eq(replacementReceivesTable.replacementId, id))
    .orderBy(desc(replacementReceivesTable.receiveDate));

  res.json(fmtRepl({ ...rows[0].r, productName: rows[0].productName, productCode: rows[0].productCode }, receives));
});

// Bulk create replacements
router.post("/inventory/company-replacements/bulk-create", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { companyId, companyName, dateSent, notes, items } = req.body;

  if (!companyName?.trim()) { res.status(400).json({ error: "companyName required" }); return; }
  if (!dateSent) { res.status(400).json({ error: "dateSent required" }); return; }
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "items required" }); return; }

  const sentDate = new Date(dateSent);
  const results: any[] = [];

  for (const item of items) {
    const { code, productId: rawProductId, sentQty, faultReason } = item;
    const qty = parseFloat(sentQty || "0");
    if (!qty || qty <= 0 || !faultReason?.trim()) continue;

    let resolvedProductId: number | null = rawProductId ? parseInt(rawProductId) : null;

    // If no productId given, look up by code
    if (!resolvedProductId && code?.trim()) {
      const [prod] = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(and(eq(productsTable.userId, userId), eq(productsTable.code, code.trim())));
      if (prod) resolvedProductId = prod.id;
    }

    if (!resolvedProductId) continue;

    const [replacement] = await db.insert(companyReplacementsTable).values({
      userId,
      productId: resolvedProductId,
      companyId: companyId ? parseInt(companyId) : null,
      companyName: companyName.trim(),
      sentQty: qty.toString(),
      receivedQty: "0",
      dateSent: sentDate,
      faultReason: faultReason.trim(),
      customerName: item.customerName?.trim() || null,
      referenceNo: item.referenceNo?.trim() || null,
      status: "pending",
      notes: notes?.trim() || null,
    }).returning();

    results.push(replacement);
  }

  res.status(201).json({ count: results.length });
});

// Create replacement
router.post("/inventory/company-replacements", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { productId, companyId, companyName, sentQty, dateSent, faultReason, customerName, referenceNo, notes } = req.body;

  if (!productId || !companyName?.trim() || !sentQty || !dateSent || !faultReason?.trim()) {
    res.status(400).json({ error: "productId, companyName, sentQty, dateSent, faultReason required" }); return;
  }

  const [replacement] = await db.insert(companyReplacementsTable).values({
    userId,
    productId: parseInt(productId),
    companyId: companyId ? parseInt(companyId) : null,
    companyName: companyName.trim(),
    sentQty: parseFloat(sentQty).toString(),
    receivedQty: "0",
    dateSent: new Date(dateSent),
    faultReason: faultReason.trim(),
    customerName: customerName?.trim() || null,
    referenceNo: referenceNo?.trim() || null,
    status: "pending",
    notes: notes?.trim() || null,
  }).returning();

  res.status(201).json(fmtRepl(replacement));
});

// Receive replacement (partial or full)
router.post("/inventory/company-replacements/:id/receive", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { receivedQty, receiveDate, notes } = req.body;

  if (!receivedQty || !receiveDate) {
    res.status(400).json({ error: "receivedQty and receiveDate required" }); return;
  }

  const [replacement] = await db
    .select()
    .from(companyReplacementsTable)
    .where(and(eq(companyReplacementsTable.id, id), eq(companyReplacementsTable.userId, userId)));

  if (!replacement) { res.status(404).json({ error: "Not found" }); return; }
  if (replacement.status === "completed" || replacement.status === "rejected") {
    res.status(400).json({ error: "Cannot receive on a completed/rejected replacement" }); return;
  }

  const qty = parseFloat(receivedQty.toString());
  const currentReceived = parseFloat(replacement.receivedQty as string);
  const sentQty = parseFloat(replacement.sentQty as string);
  const newReceived = currentReceived + qty;
  const newStatus = newReceived >= sentQty ? "completed" : "partially_received";

  // Record receive entry
  await db.insert(replacementReceivesTable).values({
    replacementId: id,
    receivedQty: qty.toString(),
    receiveDate: new Date(receiveDate),
    notes: notes?.trim() || null,
  });

  // Update replacement record
  await db.update(companyReplacementsTable)
    .set({ receivedQty: newReceived.toString(), status: newStatus })
    .where(eq(companyReplacementsTable.id, id));

  // Add received qty to product stock
  await db.update(productsTable)
    .set({ stockQty: sql`${productsTable.stockQty} + ${qty}` })
    .where(eq(productsTable.id, replacement.productId));

  res.json({ ok: true, newStatus, newReceived, pendingQty: Math.max(0, sentQty - newReceived) });
});

// Update (reject, edit notes, etc.)
router.patch("/inventory/company-replacements/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { status, notes, faultReason, customerName, referenceNo } = req.body;

  const upd: Record<string, any> = {};
  if (status !== undefined) upd.status = status;
  if (notes !== undefined) upd.notes = notes;
  if (faultReason !== undefined) upd.faultReason = faultReason;
  if (customerName !== undefined) upd.customerName = customerName || null;
  if (referenceNo !== undefined) upd.referenceNo = referenceNo || null;

  const [updated] = await db.update(companyReplacementsTable)
    .set(upd)
    .where(and(eq(companyReplacementsTable.id, id), eq(companyReplacementsTable.userId, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtRepl(updated));
});

export default router;
