import { Router, type IRouter } from "express";
import { eq, and, ilike, or, isNull, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, purchaseBillsTable, purchaseBillItemsTable, productsTable, companiesTable, productPriceHistoryTable, creditsTable, entriesTable } from "@workspace/db";

const productCompanyAlias = alias(companiesTable, "product_company");
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatBill(b: typeof purchaseBillsTable.$inferSelect) {
  return {
    id: b.id,
    userId: b.userId,
    supplierName: b.supplierName,
    companyId: b.companyId ?? null,
    billNumber: b.billNumber,
    billDate: b.billDate.toISOString(),
    totalAmount: parseFloat(b.totalAmount as string),
    paidAmount: parseFloat((b.paidAmount ?? "0") as string),
    notes: b.notes ?? null,
    deletedAt: b.deletedAt ? b.deletedAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function formatItem(i: typeof purchaseBillItemsTable.$inferSelect & {
  productName?: string; productCode?: string; companyName?: string; categoryName?: string;
}) {
  return {
    id: i.id,
    billId: i.billId,
    productId: i.productId,
    productName: i.productName ?? null,
    productCode: i.productCode ?? null,
    companyName: i.companyName ?? null,
    categoryName: i.categoryName ?? null,
    quantity: parseFloat(i.quantity as string),
    purchaseRate: parseFloat(i.purchaseRate as string),
    saleRate: parseFloat((i.saleRate ?? "0") as string),
    discount: parseFloat(i.discount as string),
    totalAmount: parseFloat(i.totalAmount as string),
    createdAt: i.createdAt.toISOString(),
  };
}

// List bills with filters
router.get("/inventory/purchase-bills", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { search, supplierName, billNumber, dateFrom, dateTo, companyId, productId } = req.query;

  const conditions: any[] = [eq(purchaseBillsTable.userId, userId), isNull(purchaseBillsTable.deletedAt)];
  if (supplierName) conditions.push(ilike(purchaseBillsTable.supplierName, `%${supplierName}%`));
  if (billNumber) conditions.push(ilike(purchaseBillsTable.billNumber, `%${billNumber}%`));
  if (companyId) {
    const cid = parseInt(companyId as string);
    // Match bill-level company OR any item whose product belongs to this company (mixed bills)
    conditions.push(or(
      eq(purchaseBillsTable.companyId, cid),
      sql`EXISTS (SELECT 1 FROM purchase_bill_items pbi JOIN products p ON p.id = pbi.product_id WHERE pbi.bill_id = ${purchaseBillsTable.id} AND p.company_id = ${cid})`
    ));
  }
  if (productId) {
    const pid = parseInt(productId as string);
    // Only bills that contain at least one item for this product
    conditions.push(
      sql`EXISTS (SELECT 1 FROM purchase_bill_items pbi WHERE pbi.bill_id = ${purchaseBillsTable.id} AND pbi.product_id = ${pid})`
    );
  }
  if (dateFrom) conditions.push(gte(purchaseBillsTable.billDate, new Date(dateFrom as string)));
  if (dateTo) {
    const to = new Date(dateTo as string);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(purchaseBillsTable.billDate, to));
  }
  if (search) {
    conditions.push(or(
      ilike(purchaseBillsTable.supplierName, `%${search}%`),
      ilike(purchaseBillsTable.billNumber, `%${search}%`)
    ));
  }

  const bills = await db
    .select({
      bill: purchaseBillsTable,
      companyName: companiesTable.name,
    })
    .from(purchaseBillsTable)
    .leftJoin(companiesTable, eq(purchaseBillsTable.companyId, companiesTable.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseBillsTable.billDate));

  res.json(bills.map(r => ({ ...formatBill(r.bill), companyName: r.companyName ?? null })));
});

// Get single bill with items
router.get("/inventory/purchase-bills/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);

  const [billRow] = await db
    .select({ bill: purchaseBillsTable, companyName: companiesTable.name })
    .from(purchaseBillsTable)
    .leftJoin(companiesTable, eq(purchaseBillsTable.companyId, companiesTable.id))
    .where(and(eq(purchaseBillsTable.id, id), eq(purchaseBillsTable.userId, userId)));

  if (!billRow) { res.status(404).json({ error: "Bill not found" }); return; }

  const items = await db
    .select({
      item: purchaseBillItemsTable,
      productName: productsTable.name,
      productCode: productsTable.code,
      companyName: productCompanyAlias.name,
    })
    .from(purchaseBillItemsTable)
    .leftJoin(productsTable, eq(purchaseBillItemsTable.productId, productsTable.id))
    .leftJoin(productCompanyAlias, eq(productsTable.companyId, productCompanyAlias.id))
    .where(eq(purchaseBillItemsTable.billId, id));

  res.json({
    ...formatBill(billRow.bill),
    companyName: billRow.companyName ?? null,
    items: items.map(r => formatItem({ ...r.item, productName: r.productName ?? undefined, productCode: r.productCode ?? undefined, companyName: r.companyName ?? undefined })),
  });
});

// Create bill with items
router.post("/inventory/purchase-bills", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { supplierName, companyId, billNumber, billDate, notes, items, updateProductPrices } = req.body;

  if (!supplierName?.trim() || !billNumber?.trim()) {
    res.status(400).json({ error: "Supplier name and bill number required" });
    return;
  }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item required" });
    return;
  }

  let totalAmount = 0;
  for (const item of items) {
    const qty = parseFloat(item.quantity ?? 0);
    const rate = parseFloat(item.purchaseRate ?? 0);
    const disc = parseFloat(item.discount ?? 0);
    totalAmount += Math.max(0, qty * rate - disc);
  }

  const [bill] = await db.insert(purchaseBillsTable).values({
    userId,
    supplierName: supplierName.trim(),
    companyId: companyId ? parseInt(companyId) : null,
    billNumber: billNumber.trim(),
    billDate: billDate ? new Date(billDate) : new Date(),
    totalAmount: totalAmount.toString(),
    notes: notes?.trim() ?? null,
  }).returning();

  for (const item of items) {
    const qty = parseFloat(item.quantity ?? 0);
    const rate = parseFloat(item.purchaseRate ?? 0);
    const saleRate = parseFloat(item.saleRate ?? 0);
    const disc = parseFloat(item.discount ?? 0);
    const lineTotal = Math.max(0, qty * rate - disc);
    const productId = parseInt(item.productId);

    await db.insert(purchaseBillItemsTable).values({
      billId: bill.id,
      productId,
      quantity: qty.toString(),
      purchaseRate: rate.toString(),
      saleRate: saleRate.toString(),
      discount: disc.toString(),
      totalAmount: lineTotal.toString(),
    });

    // Increment stock; also stamp companyId onto the product if it doesn't have one yet
    const resolvedCompanyId = companyId ? parseInt(companyId) : null;
    if (resolvedCompanyId) {
      await db.execute(
        sql`UPDATE products SET stock_qty = stock_qty + ${qty}, company_id = COALESCE(company_id, ${resolvedCompanyId}) WHERE id = ${productId} AND user_id = ${userId}`
      );
    } else {
      await db.execute(
        sql`UPDATE products SET stock_qty = stock_qty + ${qty} WHERE id = ${productId} AND user_id = ${userId}`
      );
    }

    // Optionally update purchase/sale price on product + log price history
    if (updateProductPrices) {
      const updates: string[] = [];
      if (rate > 0) updates.push(`purchase_price = ${rate}`);
      if (saleRate > 0) updates.push(`sale_price = ${saleRate}`);
      if (updates.length > 0) {
        await db.execute(
          sql`UPDATE products SET ${sql.raw(updates.join(", "))} WHERE id = ${productId} AND user_id = ${userId}`
        );
        await db.insert(productPriceHistoryTable).values({
          userId,
          productId,
          purchasePrice: rate > 0 ? rate.toString() : null,
          salePrice: saleRate > 0 ? saleRate.toString() : null,
          billId: bill.id,
          source: "purchase",
        });
      }
    }
  }

  const itemRows = await db
    .select({ item: purchaseBillItemsTable, productName: productsTable.name, productCode: productsTable.code })
    .from(purchaseBillItemsTable)
    .leftJoin(productsTable, eq(purchaseBillItemsTable.productId, productsTable.id))
    .where(eq(purchaseBillItemsTable.billId, bill.id));

  res.status(201).json({
    ...formatBill(bill),
    items: itemRows.map(r => formatItem({ ...r.item, productName: r.productName ?? undefined, productCode: r.productCode ?? undefined })),
  });
});

// ── Bulk Create: new products + stock in one bill ────────────────────────────
router.post("/inventory/purchase-bills/bulk-create", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { companyId, supplierName: supplierInput, billNumber, billDate, notes, items, isCredit, mixed, updateProductCompany, paidAmount, paymentMethod } = req.body;

  if (!billNumber?.trim()) { res.status(400).json({ error: "Bill number required" }); return; }
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: "At least one item required" }); return; }

  // ── Tenant validation: every submitted companyId (bill-level + per-item) must belong to this user ──
  const submittedCompanyIds = new Set<number>();
  if (companyId) { const n = parseInt(companyId); if (!isNaN(n)) submittedCompanyIds.add(n); }
  for (const it of items) {
    if (it?.companyId) { const n = parseInt(it.companyId); if (!isNaN(n)) submittedCompanyIds.add(n); }
  }
  if (submittedCompanyIds.size > 0) {
    const owned = await db.select({ id: companiesTable.id }).from(companiesTable)
      .where(and(eq(companiesTable.userId, userId), inArray(companiesTable.id, [...submittedCompanyIds])));
    const ownedIds = new Set(owned.map(c => c.id));
    const invalid = [...submittedCompanyIds].filter(id => !ownedIds.has(id));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Invalid company id(s): ${invalid.join(", ")}` });
      return;
    }
  }

  // Resolve supplier name and company ID
  let resolvedSupplier = (supplierInput || "").trim();
  let resolvedCompanyId: number | null = companyId ? parseInt(companyId) : null;

  if (mixed) {
    // Explicit mixed-company bill: no bill-level company; per-item companies apply
    resolvedCompanyId = null;
    if (!resolvedSupplier) resolvedSupplier = "Mix Companies";
  } else {
    if (!resolvedCompanyId && resolvedSupplier) {
      // Try to find company by name (case-insensitive) so typing "medianet" = same as selecting from master
      const [co] = await db.select().from(companiesTable)
        .where(and(ilike(companiesTable.name, resolvedSupplier), eq(companiesTable.userId, userId)));
      if (co) resolvedCompanyId = co.id;
    }
    if (!resolvedSupplier && resolvedCompanyId) {
      const [co] = await db.select().from(companiesTable).where(and(eq(companiesTable.id, resolvedCompanyId), eq(companiesTable.userId, userId)));
      resolvedSupplier = co?.name ?? "Direct Purchase";
    }
    if (!resolvedSupplier) resolvedSupplier = "Direct Purchase";
  }

  let totalAmount = 0;
  const resolvedItems: Array<{ productId: number; quantity: number; purchaseRate: number; saleRate: number; lineTotal: number; isNew: boolean }> = [];

  for (const item of items) {
    const code = (item.code || "").trim();
    const name = (item.name || "").trim();
    if (!name) continue;
    const qty = parseFloat(item.quantity ?? 0);
    if (qty <= 0) continue;
    const purchaseRate = parseFloat(item.purchaseRate ?? 0);
    const saleRate = parseFloat(item.saleRate ?? 0);
    const minStockAlert = parseFloat(item.minStockAlert ?? 0);

    let productId: number;
    let isNew = false;

    // Try to find existing product by code (if provided), then by name
    let existing: typeof productsTable.$inferSelect | undefined;
    if (code) {
      const rows = await db.select().from(productsTable)
        .where(and(eq(productsTable.userId, userId), ilike(productsTable.code, code), isNull(productsTable.deletedAt)));
      existing = rows[0];
    }
    if (!existing) {
      const rows = await db.select().from(productsTable)
        .where(and(eq(productsTable.userId, userId), ilike(productsTable.name, name), isNull(productsTable.deletedAt)));
      existing = rows[0];
    }

    // Per-item companyId overrides the bill-level companyId for this product
    const itemCompanyId = item.companyId ? parseInt(item.companyId) : resolvedCompanyId;

    if (existing) {
      productId = existing.id;
      // Add stock; update company_id only if null (safe default) or if the user explicitly opted to override it
      if (itemCompanyId) {
        const companyUpdate = updateProductCompany
          ? sql`company_id = ${itemCompanyId}`
          : sql`company_id = COALESCE(company_id, ${itemCompanyId})`;
        await db.execute(sql`UPDATE products SET stock_qty = stock_qty + ${qty}, ${companyUpdate}, updated_at = NOW() WHERE id = ${productId} AND user_id = ${userId}`);
      } else {
        await db.execute(sql`UPDATE products SET stock_qty = stock_qty + ${qty}, updated_at = NOW() WHERE id = ${productId} AND user_id = ${userId}`);
      }
      // Update prices if provided
      if (purchaseRate > 0 || saleRate > 0) {
        const setParts: string[] = [];
        if (purchaseRate > 0) setParts.push(`purchase_price = ${purchaseRate}`);
        if (saleRate > 0) setParts.push(`sale_price = ${saleRate}`);
        await db.execute(sql`UPDATE products SET ${sql.raw(setParts.join(", "))} WHERE id = ${productId} AND user_id = ${userId}`);
        await db.insert(productPriceHistoryTable).values({
          userId,
          productId,
          purchasePrice: purchaseRate > 0 ? purchaseRate.toString() : null,
          salePrice: saleRate > 0 ? saleRate.toString() : null,
          billId: null,
          source: "purchase",
        });
      }
    } else {
      isNew = true;
      const autoCode = code || `PRD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
      const [newProd] = await db.insert(productsTable).values({
        userId,
        code: autoCode,
        name,
        companyId: itemCompanyId,
        categoryId: item.categoryId ? parseInt(item.categoryId) : null,
        collectionId: item.collectionId ? parseInt(item.collectionId) : null,
        purchasePrice: purchaseRate.toString(),
        salePrice: saleRate.toString(),
        stockQty: qty.toString(),
        minStockAlert: minStockAlert.toString(),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      }).returning();
      productId = newProd.id;
    }

    const lineTotal = qty * purchaseRate;
    totalAmount += lineTotal;
    resolvedItems.push({ productId, quantity: qty, purchaseRate, saleRate, lineTotal, isNew });
  }

  if (resolvedItems.length === 0) { res.status(400).json({ error: "No valid items to save" }); return; }

  const creditPurchase = isCredit === true || isCredit === "true";
  const requestedPaidAmount = creditPurchase ? Number(paidAmount ?? 0) : totalAmount;
  if (!Number.isFinite(requestedPaidAmount) || requestedPaidAmount < 0 || requestedPaidAmount > totalAmount) {
    res.status(400).json({ error: "Paid amount must be between zero and the bill total" });
    return;
  }
  const normalizedPaidAmount = Math.round(requestedPaidAmount * 100) / 100;
  const remainingCredit = Math.round((totalAmount - normalizedPaidAmount) * 100) / 100;

  const [bill] = await db.insert(purchaseBillsTable).values({
    userId,
    supplierName: resolvedSupplier,
    companyId: resolvedCompanyId,
    billNumber: billNumber.trim(),
    billDate: billDate ? new Date(billDate) : new Date(),
    totalAmount: totalAmount.toString(),
    paidAmount: normalizedPaidAmount.toString(),
    notes: notes?.trim() ?? null,
    isCredit: remainingCredit > 0,
  }).returning();

  for (const ri of resolvedItems) {
    await db.insert(purchaseBillItemsTable).values({
      billId: bill.id,
      productId: ri.productId,
      quantity: ri.quantity.toString(),
      purchaseRate: ri.purchaseRate.toString(),
      saleRate: ri.saleRate.toString(),
      discount: "0",
      totalAmount: ri.lineTotal.toString(),
    });
  }

  // Auto-create supplier credit when purchased on credit
  if (creditPurchase && remainingCredit > 0) {
    await db.insert(creditsTable).values({
      userId,
      customerName: resolvedSupplier,
      phone: null,
      amount: remainingCredit.toString(),
      description: `Purchase Bill #${bill.billNumber} — remaining supplier credit`,
      type: "received",
      status: "pending",
      dueDate: null,
    });
  }

  if (normalizedPaidAmount > 0) {
    await db.insert(entriesTable).values({
      userId,
      type: "cash_out",
      amount: normalizedPaidAmount.toString(),
      description: `Payment to supplier ${resolvedSupplier} against Purchase Bill #${bill.billNumber}`,
      paymentMethod: paymentMethod === "digital" ? "digital" : "cash",
      isCredit: false,
      customerName: resolvedSupplier,
      entryDate: billDate ? new Date(billDate) : new Date(),
    });
  }

  res.status(201).json({
    ...formatBill(bill),
    itemCount: resolvedItems.length,
    newProductCount: resolvedItems.filter(r => r.isNew).length,
    remainingCredit,
  });
});

// Soft delete
router.delete("/inventory/purchase-bills/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.update(purchaseBillsTable).set({ deletedAt: new Date() }).where(and(eq(purchaseBillsTable.id, id), eq(purchaseBillsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
