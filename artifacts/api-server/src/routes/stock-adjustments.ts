import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, stockAdjustmentsTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const REMOVAL_TYPES = ["damaged", "lost", "expired", "broken", "personal_use", "manual_remove"];
const ADD_TYPES = ["manual_add"];

function fmtAdj(a: any) {
  return {
    id: a.id,
    userId: a.userId,
    productId: a.productId,
    productName: a.productName ?? null,
    productCode: a.productCode ?? null,
    adjustmentType: a.adjustmentType,
    quantity: parseFloat(a.quantity),
    reason: a.reason ?? null,
    adjustmentDate: a.adjustmentDate instanceof Date ? a.adjustmentDate.toISOString() : a.adjustmentDate,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
  };
}

// List adjustments (optionally filter by productId)
router.get("/inventory/stock-adjustments", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { productId } = req.query;

  const conditions: any[] = [eq(stockAdjustmentsTable.userId, userId)];
  if (productId) conditions.push(eq(stockAdjustmentsTable.productId, parseInt(productId as string)));

  const rows = await db
    .select({
      adj: stockAdjustmentsTable,
      productName: productsTable.name,
      productCode: productsTable.code,
    })
    .from(stockAdjustmentsTable)
    .leftJoin(productsTable, eq(stockAdjustmentsTable.productId, productsTable.id))
    .where(and(...conditions))
    .orderBy(desc(stockAdjustmentsTable.adjustmentDate));

  res.json(rows.map((r) => fmtAdj({ ...r.adj, productName: r.productName, productCode: r.productCode })));
});

// Create adjustment — auto-updates product stock
router.post("/inventory/stock-adjustments", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { productId, adjustmentType, quantity, reason, adjustmentDate } = req.body;

  if (!productId || !adjustmentType || !quantity || !adjustmentDate) {
    res.status(400).json({ error: "productId, adjustmentType, quantity, adjustmentDate required" }); return;
  }

  const qty = parseFloat(quantity.toString());
  if (qty <= 0) { res.status(400).json({ error: "Quantity must be positive" }); return; }

  const isAdd = ADD_TYPES.includes(adjustmentType);
  const isRemove = REMOVAL_TYPES.includes(adjustmentType);
  if (!isAdd && !isRemove) { res.status(400).json({ error: "Invalid adjustmentType" }); return; }

  // Insert adjustment record
  const [adj] = await db.insert(stockAdjustmentsTable).values({
    userId,
    productId: parseInt(productId),
    adjustmentType,
    quantity: qty.toString(),
    reason: reason?.trim() || null,
    adjustmentDate: new Date(adjustmentDate),
  }).returning();

  // Apply to product stock
  if (isAdd) {
    await db.update(productsTable)
      .set({ stockQty: sql`${productsTable.stockQty} + ${qty}` })
      .where(and(eq(productsTable.id, parseInt(productId)), eq(productsTable.userId, userId)));
  } else {
    await db.update(productsTable)
      .set({ stockQty: sql`GREATEST(0, ${productsTable.stockQty} - ${qty})` })
      .where(and(eq(productsTable.id, parseInt(productId)), eq(productsTable.userId, userId)));
  }

  // Return with product name
  const rows = await db
    .select({ adj: stockAdjustmentsTable, productName: productsTable.name, productCode: productsTable.code })
    .from(stockAdjustmentsTable)
    .leftJoin(productsTable, eq(stockAdjustmentsTable.productId, productsTable.id))
    .where(eq(stockAdjustmentsTable.id, adj.id));

  res.status(201).json(fmtAdj({ ...rows[0].adj, productName: rows[0].productName, productCode: rows[0].productCode }));
});

export default router;
