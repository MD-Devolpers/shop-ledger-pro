import { Router, type IRouter } from "express";
import { eq, and, ilike, or, isNull, desc, sql, lte, gte } from "drizzle-orm";
import {
  db,
  productsTable,
  companiesTable,
  categoriesTable,
  productCollectionsTable,
  companyReplacementsTable,
  purchaseBillItemsTable,
  purchaseBillsTable,
  productSalesTable,
  productSaleItemsTable,
  productReturnsTable,
  replacementReceivesTable,
  stockAdjustmentsTable,
  productPriceHistoryTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatProduct(p: typeof productsTable.$inferSelect & {
  companyName?: string | null;
  categoryName?: string | null;
  collectionName?: string | null;
  pendingReplacementQty?: number;
}) {
  const stockQty = parseFloat(p.stockQty as string);
  const pending = p.pendingReplacementQty ?? 0;
  const availableStock = Math.max(0, stockQty - pending);
  const minStock = parseFloat(p.minStockAlert as string);
  let stockStatus: "ok" | "low" | "out" = "ok";
  if (availableStock <= 0) stockStatus = "out";
  else if (minStock > 0 && availableStock <= minStock) stockStatus = "low";

  return {
    id: p.id,
    userId: p.userId,
    code: p.code,
    name: p.name,
    companyId: p.companyId,
    categoryId: p.categoryId,
    collectionId: p.collectionId,
    companyName: p.companyName ?? null,
    categoryName: p.categoryName ?? null,
    collectionName: p.collectionName ?? null,
    purchasePrice: parseFloat(p.purchasePrice as string),
    salePrice: parseFloat(p.salePrice as string),
    stockQty,
    availableStock,
    pendingReplacementQty: pending,
    minStockAlert: minStock,
    isFavorite: p.isFavorite ?? false,
    minSalePrice: p.minSalePrice != null ? parseFloat(p.minSalePrice as string) : null,
    stockStatus,
    expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null,
    deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Build a map of productId → pendingReplacementQty for a user */
async function getPendingReplacementMap(userId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({
      productId: companyReplacementsTable.productId,
      sentQty: companyReplacementsTable.sentQty,
      receivedQty: companyReplacementsTable.receivedQty,
    })
    .from(companyReplacementsTable)
    .where(
      and(
        eq(companyReplacementsTable.userId, userId),
        or(
          eq(companyReplacementsTable.status, "pending"),
          eq(companyReplacementsTable.status, "partially_received")
        ) as any
      )
    );

  const map = new Map<number, number>();
  for (const r of rows) {
    const pending = Math.max(0, parseFloat(r.sentQty as string) - parseFloat(r.receivedQty as string));
    map.set(r.productId, (map.get(r.productId) ?? 0) + pending);
  }
  return map;
}

// ── Reorder list (before :id route) ──────────────────────────────────────────
router.get("/inventory/products/reorder", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const rows = await db
    .select({
      product: productsTable,
      companyName: companiesTable.name,
      categoryName: categoriesTable.name,
      collectionName: productCollectionsTable.name,
    })
    .from(productsTable)
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productCollectionsTable, eq(productsTable.collectionId, productCollectionsTable.id))
    .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
    .orderBy(productsTable.name);

  const pendingMap = await getPendingReplacementMap(userId);

  const all = rows.map((r) =>
    formatProduct({
      ...r.product,
      companyName: r.companyName,
      categoryName: r.categoryName,
      collectionName: r.collectionName,
      pendingReplacementQty: pendingMap.get(r.product.id) ?? 0,
    })
  );

  // Only products where availableStock <= minStockAlert AND minStockAlert > 0
  const reorder = all.filter((p) => p.minStockAlert > 0 && p.availableStock <= p.minStockAlert);
  res.json(reorder);
});

// ── Stock value ───────────────────────────────────────────────────────────────
router.get("/inventory/stock-value", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const rows = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

  const pendingMap = await getPendingReplacementMap(userId);

  let totalPurchaseValue = 0;
  let totalSaleValue = 0;

  for (const p of rows) {
    const stockQty = parseFloat(p.stockQty as string);
    const pending = pendingMap.get(p.id) ?? 0;
    const availableQty = Math.max(0, stockQty - pending);
    totalPurchaseValue += availableQty * parseFloat(p.purchasePrice as string);
    totalSaleValue += availableQty * parseFloat(p.salePrice as string);
  }

  res.json({
    totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
    totalSaleValue: Math.round(totalSaleValue * 100) / 100,
    expectedProfit: Math.round((totalSaleValue - totalPurchaseValue) * 100) / 100,
  });
});

// ── Product History ───────────────────────────────────────────────────────────
router.get("/inventory/products/:id/history", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const productId = parseInt(req.params.id);

  // Verify product ownership
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  // Purchase bill items
  const purchaseItems = await db
    .select({ item: purchaseBillItemsTable, bill: purchaseBillsTable })
    .from(purchaseBillItemsTable)
    .innerJoin(purchaseBillsTable, eq(purchaseBillItemsTable.billId, purchaseBillsTable.id))
    .where(and(eq(purchaseBillItemsTable.productId, productId), isNull(purchaseBillsTable.deletedAt), eq(purchaseBillsTable.userId, userId)));

  // Sale items
  const saleItems = await db
    .select({ item: productSaleItemsTable, sale: productSalesTable })
    .from(productSaleItemsTable)
    .innerJoin(productSalesTable, eq(productSaleItemsTable.saleId, productSalesTable.id))
    .where(and(eq(productSaleItemsTable.productId, productId), isNull(productSalesTable.deletedAt), eq(productSalesTable.userId, userId)));

  // Customer returns
  const returns = await db
    .select()
    .from(productReturnsTable)
    .where(and(eq(productReturnsTable.productId, productId), eq(productReturnsTable.userId, userId)));

  // Company replacements
  const replacements = await db
    .select()
    .from(companyReplacementsTable)
    .where(and(eq(companyReplacementsTable.productId, productId), eq(companyReplacementsTable.userId, userId)));

  // Replacement receives
  const replIds = replacements.map((r) => r.id);
  let receives: any[] = [];
  if (replIds.length > 0) {
    receives = await db
      .select({ recv: replacementReceivesTable, r: companyReplacementsTable })
      .from(replacementReceivesTable)
      .innerJoin(companyReplacementsTable, eq(replacementReceivesTable.replacementId, companyReplacementsTable.id))
      .where(eq(companyReplacementsTable.productId, productId));
  }

  // Stock adjustments
  const adjustments = await db
    .select()
    .from(stockAdjustmentsTable)
    .where(and(eq(stockAdjustmentsTable.productId, productId), eq(stockAdjustmentsTable.userId, userId)));

  const events: any[] = [];

  for (const { item, bill } of purchaseItems) {
    events.push({
      type: "purchase",
      date: bill.billDate.toISOString(),
      qty: parseFloat(item.quantity as string),
      rate: parseFloat(item.purchaseRate as string),
      total: parseFloat(item.totalAmount as string),
      billNumber: bill.billNumber,
      supplierName: bill.supplierName,
      billId: bill.id,
    });
  }

  for (const { item, sale } of saleItems) {
    events.push({
      type: "sale",
      date: sale.saleDate.toISOString(),
      qty: parseFloat(item.quantity as string),
      salePrice: parseFloat(item.salePrice as string),
      profit: parseFloat(item.profit as string),
      customerName: sale.customerName ?? null,
      isCredit: sale.isCredit,
      saleId: sale.id,
    });
  }

  for (const ret of returns) {
    events.push({
      type: "return",
      date: ret.returnDate.toISOString(),
      qty: parseFloat(ret.quantity as string),
      returnAmount: parseFloat(ret.returnAmount as string),
      reason: ret.reason ?? null,
    });
  }

  for (const repl of replacements) {
    events.push({
      type: "replacement_sent",
      date: repl.dateSent.toISOString(),
      qty: parseFloat(repl.sentQty as string),
      companyName: repl.companyName,
      faultReason: repl.faultReason,
      status: repl.status,
      replacementId: repl.id,
    });
  }

  for (const { recv } of receives) {
    events.push({
      type: "replacement_received",
      date: recv.receiveDate.toISOString(),
      qty: parseFloat(recv.receivedQty as string),
      replacementId: recv.replacementId,
    });
  }

  for (const adj of adjustments) {
    events.push({
      type: "adjustment",
      date: adj.adjustmentDate.toISOString(),
      qty: parseFloat(adj.quantity as string),
      adjustmentType: adj.adjustmentType,
      reason: adj.reason ?? null,
    });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({ productId, productName: product.name, productCode: product.code, events });
});

// ── List products ─────────────────────────────────────────────────────────────
router.get("/inventory/products", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { search, companyId, categoryId, collectionId, stockStatus, favorites } = req.query;

  const conditions: any[] = [eq(productsTable.userId, userId), isNull(productsTable.deletedAt)];
  if (favorites === "true") conditions.push(eq(productsTable.isFavorite, true));

  if (search) {
    conditions.push(or(
      ilike(productsTable.name, `%${search}%`),
      ilike(productsTable.code, `%${search}%`)
    ));
  }
  if (companyId) conditions.push(eq(productsTable.companyId, parseInt(companyId as string)));
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId as string)));
  if (collectionId) conditions.push(eq(productsTable.collectionId, parseInt(collectionId as string)));

  const rows = await db
    .select({
      product: productsTable,
      companyName: companiesTable.name,
      categoryName: categoriesTable.name,
      collectionName: productCollectionsTable.name,
    })
    .from(productsTable)
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productCollectionsTable, eq(productsTable.collectionId, productCollectionsTable.id))
    .where(and(...conditions))
    .orderBy(productsTable.name);

  const pendingMap = await getPendingReplacementMap(userId);

  let results = rows.map((r) =>
    formatProduct({
      ...r.product,
      companyName: r.companyName,
      categoryName: r.categoryName,
      collectionName: r.collectionName,
      pendingReplacementQty: pendingMap.get(r.product.id) ?? 0,
    })
  );

  // Post-filter by stock status
  if (stockStatus === "low") results = results.filter((p) => p.stockStatus === "low");
  else if (stockStatus === "out") results = results.filter((p) => p.stockStatus === "out");
  else if (stockStatus === "expiry") {
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    results = results.filter((p) => p.expiryDate && new Date(p.expiryDate) <= soon);
  }

  res.json(results);
});

// ── Get single product ────────────────────────────────────────────────────────
router.get("/inventory/products/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);

  const rows = await db
    .select({
      product: productsTable,
      companyName: companiesTable.name,
      categoryName: categoriesTable.name,
      collectionName: productCollectionsTable.name,
    })
    .from(productsTable)
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productCollectionsTable, eq(productsTable.collectionId, productCollectionsTable.id))
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));

  if (!rows[0]) { res.status(404).json({ error: "Product not found" }); return; }

  const pendingMap = await getPendingReplacementMap(userId);
  const row = rows[0];
  res.json(formatProduct({
    ...row.product,
    companyName: row.companyName,
    categoryName: row.categoryName,
    collectionName: row.collectionName,
    pendingReplacementQty: pendingMap.get(id) ?? 0,
  }));
});

// ── Look up product by code (must be before /:id routes) ─────────────────────
router.get("/inventory/products/by-code/:code", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const code = decodeURIComponent(req.params.code).trim();
  const rows = await db.select().from(productsTable)
    .where(and(eq(productsTable.userId, userId), ilike(productsTable.code, code), isNull(productsTable.deletedAt)));
  if (!rows.length) { res.status(404).json({ error: "Product nahi mila" }); return; }
  res.json(formatProduct(rows[0]));
});

// ── Create product ────────────────────────────────────────────────────────────
router.post("/inventory/products", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { code, name, companyId, categoryId, collectionId, purchasePrice, salePrice, stockQty, minStockAlert, expiryDate, minSalePrice } = req.body;
  if (!code?.trim() || !name?.trim()) { res.status(400).json({ error: "Code and name required" }); return; }

  // Duplicate code check
  const existing = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.userId, userId), ilike(productsTable.code, code.trim()), isNull(productsTable.deletedAt)));
  if (existing.length > 0) {
    res.status(409).json({ error: `Product code "${code.trim()}" pehle se exist karta hai`, existingId: existing[0].id });
    return;
  }

  const [product] = await db.insert(productsTable).values({
    userId,
    code: code.trim(),
    name: name.trim(),
    companyId: companyId ? parseInt(companyId) : null,
    categoryId: categoryId ? parseInt(categoryId) : null,
    collectionId: collectionId ? parseInt(collectionId) : null,
    purchasePrice: (purchasePrice ?? 0).toString(),
    salePrice: (salePrice ?? 0).toString(),
    stockQty: (stockQty ?? 0).toString(),
    minStockAlert: (minStockAlert ?? 0).toString(),
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    minSalePrice: (minSalePrice != null && minSalePrice !== "") ? parseFloat(minSalePrice).toString() : null,
  }).returning();

  res.status(201).json(formatProduct(product));
});

// ── Update product ────────────────────────────────────────────────────────────
router.patch("/inventory/products/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { code, name, companyId, categoryId, collectionId, purchasePrice, salePrice, stockQty, minStockAlert, expiryDate, minSalePrice } = req.body;

  const updateData: Record<string, unknown> = {};
  if (code !== undefined) updateData.code = code.trim();
  if (name !== undefined) updateData.name = name.trim();
  if (companyId !== undefined) updateData.companyId = companyId ? parseInt(companyId) : null;
  if (categoryId !== undefined) updateData.categoryId = categoryId ? parseInt(categoryId) : null;
  if (collectionId !== undefined) updateData.collectionId = collectionId ? parseInt(collectionId) : null;
  if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice.toString();
  if (salePrice !== undefined) updateData.salePrice = salePrice.toString();
  if (stockQty !== undefined) updateData.stockQty = stockQty.toString();
  if (minStockAlert !== undefined) updateData.minStockAlert = minStockAlert.toString();
  if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
  if (minSalePrice !== undefined) updateData.minSalePrice = (minSalePrice !== "" && minSalePrice != null) ? parseFloat(minSalePrice).toString() : null;

  const [product] = await db.update(productsTable).set(updateData).where(and(eq(productsTable.id, id), eq(productsTable.userId, userId))).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(product));
});

// ── Toggle favorite ───────────────────────────────────────────────────────────
router.patch("/inventory/products/:id/favorite", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const [current] = await db.select({ isFavorite: productsTable.isFavorite }).from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));
  if (!current) { res.status(404).json({ error: "Product not found" }); return; }
  const [updated] = await db.update(productsTable)
    .set({ isFavorite: !current.isFavorite })
    .where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)))
    .returning();
  res.json({ id: updated.id, isFavorite: updated.isFavorite });
});

// ── Price history ─────────────────────────────────────────────────────────────
router.get("/inventory/products/:id/price-history", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const rows = await db
    .select({
      history: productPriceHistoryTable,
      billNumber: purchaseBillsTable.billNumber,
    })
    .from(productPriceHistoryTable)
    .leftJoin(purchaseBillsTable, eq(productPriceHistoryTable.billId, purchaseBillsTable.id))
    .where(and(eq(productPriceHistoryTable.userId, userId), eq(productPriceHistoryTable.productId, id)))
    .orderBy(desc(productPriceHistoryTable.createdAt));
  res.json(rows.map(r => ({
    id: r.history.id,
    purchasePrice: r.history.purchasePrice ? parseFloat(r.history.purchasePrice) : null,
    salePrice: r.history.salePrice ? parseFloat(r.history.salePrice) : null,
    billId: r.history.billId,
    billNumber: r.billNumber ?? null,
    source: r.history.source,
    createdAt: r.history.createdAt,
  })));
});

// ── Bulk assign company to multiple products ──────────────────────────────────
router.post("/inventory/products/bulk-assign-company", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { companyId, productIds } = req.body;
  if (!companyId || !Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ error: "companyId and productIds[] required" }); return;
  }
  const cid = parseInt(companyId);
  let updated = 0;
  for (const pid of productIds) {
    const result = await db.update(productsTable)
      .set({ companyId: cid })
      .where(and(eq(productsTable.id, parseInt(pid)), eq(productsTable.userId, userId)));
    updated++;
  }
  res.json({ updated });
});

// ── Soft delete product ───────────────────────────────────────────────────────
router.delete("/inventory/products/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.update(productsTable).set({ deletedAt: new Date() }).where(and(eq(productsTable.id, id), eq(productsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
