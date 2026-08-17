import { Router, type IRouter } from "express";
import { eq, and, desc, isNotNull, inArray } from "drizzle-orm";
import {
  db,
  productsTable,
  purchaseBillsTable,
  purchaseBillItemsTable,
  productSalesTable,
  productSaleItemsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ── List all soft-deleted inventory items ──────────────────────────────────
router.get("/recycle-bin/inventory", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const [products, bills, sales] = await Promise.all([
    db.select().from(productsTable)
      .where(and(eq(productsTable.userId, userId), isNotNull(productsTable.deletedAt)))
      .orderBy(desc(productsTable.deletedAt)),
    db.select().from(purchaseBillsTable)
      .where(and(eq(purchaseBillsTable.userId, userId), isNotNull(purchaseBillsTable.deletedAt)))
      .orderBy(desc(purchaseBillsTable.deletedAt)),
    db.select().from(productSalesTable)
      .where(and(eq(productSalesTable.userId, userId), isNotNull(productSalesTable.deletedAt)))
      .orderBy(desc(productSalesTable.deletedAt)),
  ]);

  res.json({
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      stockQty: parseFloat(p.stockQty as string),
      purchasePrice: parseFloat(p.purchasePrice as string),
      salePrice: parseFloat(p.salePrice as string),
      deletedAt: p.deletedAt!.toISOString(),
    })),
    purchaseBills: bills.map(b => ({
      id: b.id,
      billNumber: b.billNumber,
      supplierName: b.supplierName ?? null,
      totalAmount: parseFloat(b.totalAmount as string),
      billDate: b.billDate.toISOString(),
      deletedAt: b.deletedAt!.toISOString(),
    })),
    productSales: sales.map(s => ({
      id: s.id,
      customerName: s.customerName ?? null,
      totalAmount: parseFloat(s.totalAmount as string),
      saleDate: s.saleDate.toISOString(),
      deletedAt: s.deletedAt!.toISOString(),
    })),
  });
});

const RESTORABLE = {
  product: productsTable,
  "purchase-bill": purchaseBillsTable,
  "product-sale": productSalesTable,
} as const;

// ── Restore ────────────────────────────────────────────────────────────────
router.post("/recycle-bin/inventory/:type/:id/restore", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(String(req.params.id));
  const table = RESTORABLE[req.params.type as keyof typeof RESTORABLE];
  if (!table || isNaN(id)) {
    res.status(400).json({ error: "Invalid type or id" });
    return;
  }
  const [row] = await db
    .update(table)
    .set({ deletedAt: null })
    .where(and(eq(table.id, id), eq(table.userId, userId), isNotNull(table.deletedAt)))
    .returning({ id: table.id });
  if (!row) {
    res.status(404).json({ error: "Item not found in recycle bin" });
    return;
  }
  res.json({ success: true });
});

// ── Permanent delete ───────────────────────────────────────────────────────
router.delete("/recycle-bin/inventory/:type/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(String(req.params.id));
  const type = req.params.type as keyof typeof RESTORABLE;
  const table = RESTORABLE[type];
  if (!table || isNaN(id)) {
    res.status(400).json({ error: "Invalid type or id" });
    return;
  }

  // Only allow permanent delete of already soft-deleted rows owned by user
  const [row] = await db.select({ id: table.id }).from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId), isNotNull(table.deletedAt)));
  if (!row) {
    res.status(404).json({ error: "Item not found in recycle bin" });
    return;
  }

  await db.transaction(async (tx) => {
    if (type === "purchase-bill") {
      await tx.delete(purchaseBillItemsTable).where(eq(purchaseBillItemsTable.billId, id));
    }
    if (type === "product-sale") {
      await tx.delete(productSaleItemsTable).where(eq(productSaleItemsTable.saleId, id));
    }
    await tx.delete(table).where(and(eq(table.id, id), eq(table.userId, userId)));
  });
  res.json({ success: true });
});

export default router;
