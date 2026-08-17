import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, ilike, gte, lte, sql, inArray } from "drizzle-orm";
import {
  db,
  productSalesTable,
  productSaleItemsTable,
  productReturnsTable,
  productsTable,
  entriesTable,
  creditsTable,
  billSettingsTable,
  saleEditHistoryTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatSale(s: typeof productSalesTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    entryId: s.entryId,
    creditId: s.creditId,
    customerName: s.customerName ?? null,
    contactNumber: s.contactNumber ?? null,
    paymentMethod: s.paymentMethod,
    isCredit: s.isCredit,
    totalAmount: parseFloat(s.totalAmount as string),
    totalProfit: parseFloat(s.totalProfit as string),
    discount: parseFloat(s.discount as string),
    discountType: s.discountType,
    notes: s.notes ?? null,
    status: s.status ?? "active",
    cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
    cancelledBy: s.cancelledBy ?? null,
    saleDate: s.saleDate.toISOString(),
    deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function formatSaleItem(i: typeof productSaleItemsTable.$inferSelect & { productName?: string; productCode?: string }) {
  return {
    id: i.id,
    saleId: i.saleId,
    productId: i.productId,
    productName: i.productName ?? null,
    productCode: i.productCode ?? null,
    quantity: parseFloat(i.quantity as string),
    purchasePrice: parseFloat(i.purchasePrice as string),
    salePrice: parseFloat(i.salePrice as string),
    discount: parseFloat(i.discount as string),
    discountType: i.discountType,
    lineTotal: parseFloat(i.lineTotal as string),
    profit: parseFloat(i.profit as string),
  };
}

// List sales
router.get("/inventory/product-sales", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { search, dateFrom, dateTo, paymentMethod } = req.query;

  const conditions: any[] = [eq(productSalesTable.userId, userId), isNull(productSalesTable.deletedAt)];
  if (search) conditions.push(ilike(productSalesTable.customerName, `%${search}%`));
  if (dateFrom) conditions.push(gte(productSalesTable.saleDate, new Date(dateFrom as string)));
  if (dateTo) {
    const to = new Date(dateTo as string);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(productSalesTable.saleDate, to));
  }
  if (paymentMethod) conditions.push(eq(productSalesTable.paymentMethod, paymentMethod as any));

  const sales = await db
    .select()
    .from(productSalesTable)
    .where(and(...conditions))
    .orderBy(desc(productSalesTable.saleDate));

  // Attach items (with product name/code) so reports can aggregate per product
  const saleIds = sales.map(s => s.id);
  const itemsBySale: Record<number, ReturnType<typeof formatSaleItem>[]> = {};
  if (saleIds.length > 0) {
    const itemRows = await db
      .select({ item: productSaleItemsTable, productName: productsTable.name, productCode: productsTable.code })
      .from(productSaleItemsTable)
      .leftJoin(productsTable, eq(productSaleItemsTable.productId, productsTable.id))
      .where(inArray(productSaleItemsTable.saleId, saleIds));
    for (const r of itemRows) {
      const fi = formatSaleItem({ ...r.item, productName: r.productName ?? undefined, productCode: r.productCode ?? undefined });
      (itemsBySale[r.item.saleId] ??= []).push(fi);
    }
  }

  res.json(sales.map(s => ({ ...formatSale(s), items: itemsBySale[s.id] ?? [] })));
});

// Get single sale with items (for bill generation)
router.get("/inventory/product-sales/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);

  const [sale] = await db.select().from(productSalesTable).where(and(eq(productSalesTable.id, id), eq(productSalesTable.userId, userId)));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

  const itemRows = await db
    .select({ item: productSaleItemsTable, productName: productsTable.name, productCode: productsTable.code })
    .from(productSaleItemsTable)
    .leftJoin(productsTable, eq(productSaleItemsTable.productId, productsTable.id))
    .where(eq(productSaleItemsTable.saleId, id));

  res.json({
    ...formatSale(sale),
    items: itemRows.map(r => formatSaleItem({ ...r.item, productName: r.productName ?? undefined, productCode: r.productCode ?? undefined })),
  });
});

// Create product sale
router.post("/inventory/product-sales", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const {
    customerName,
    contactNumber,
    paymentMethod = "cash",
    isCredit = false,
    discount = 0,
    discountType = "fixed",
    notes,
    saleDate,
    items,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item required" });
    return;
  }

  // Validate stock for each item and collect product names
  const productNameMap: Record<number, string> = {};
  for (const item of items) {
    const [product] = await db.select({ stockQty: productsTable.stockQty, name: productsTable.name }).from(productsTable)
      .where(and(eq(productsTable.id, parseInt(item.productId)), eq(productsTable.userId, userId)));
    if (!product) { res.status(400).json({ error: `Product ${item.productId} not found` }); return; }
    if (parseFloat(product.stockQty as string) < parseFloat(item.quantity)) {
      res.status(400).json({ error: `Insufficient stock for product ${item.productId}` });
      return;
    }
    productNameMap[parseInt(item.productId)] = product.name;
  }

  // Calculate totals
  let totalAmount = 0;
  let totalProfit = 0;
  const itemDetails: Array<{ productId: number; quantity: number; purchasePrice: number; salePrice: number; itemDiscount: number; itemDiscountType: string; lineTotal: number; profit: number }> = [];

  for (const item of items) {
    const qty = parseFloat(item.quantity);
    const purchasePrice = parseFloat(item.purchasePrice);
    let salePrice = parseFloat(item.salePrice);
    const itemDiscount = parseFloat(item.discount ?? 0);
    const itemDiscountType: string = item.discountType ?? "fixed";

    let lineTotal: number;
    if (itemDiscountType === "percent") {
      lineTotal = qty * salePrice * (1 - itemDiscount / 100);
    } else if (itemDiscountType === "fixed" && itemDiscount > 0) {
      // If fixed discount provided as final price
      lineTotal = qty * salePrice - itemDiscount;
    } else {
      lineTotal = qty * salePrice;
    }

    const profit = lineTotal - qty * purchasePrice;
    totalAmount += lineTotal;
    totalProfit += profit;
    itemDetails.push({ productId: parseInt(item.productId), quantity: qty, purchasePrice, salePrice, itemDiscount, itemDiscountType, lineTotal, profit });
  }

  // Apply overall discount
  const discountAmt = parseFloat(discount.toString());
  let finalAmount = totalAmount;
  if (discountType === "percent") finalAmount = totalAmount * (1 - discountAmt / 100);
  else finalAmount = totalAmount - discountAmt;

  // Create ledger entry — use product names in description
  const productNames = items.map((it: any) => productNameMap[parseInt(it.productId)]).filter(Boolean);
  const productLabel = productNames.length === 0
    ? "Product Sale"
    : productNames.length === 1
      ? productNames[0]
      : `${productNames[0]} +${productNames.length - 1} more`;
  const description = `${productLabel}${customerName ? ` - ${customerName}` : ""}`;
  const [entry] = await db.insert(entriesTable).values({
    userId,
    type: "cash_in",
    amount: finalAmount.toString(),
    description,
    paymentMethod: isCredit ? "cash" : paymentMethod,
    profit: totalProfit.toString(),
    isCredit: !!isCredit,
    isFundOperation: false,
    customerName: customerName ?? null,
    contactNumber: contactNumber ?? null,
    source: "product_sale",
    entryDate: saleDate ? new Date(saleDate) : new Date(),
  }).returning();

  // If credit sale, create credits row
  let creditId: number | null = null;
  if (isCredit && customerName) {
    const [credit] = await db.insert(creditsTable).values({
      userId,
      customerName,
      phone: contactNumber ?? null,
      amount: finalAmount.toString(),
      description: (() => {
        const names = items.map((it: any) => productNameMap[parseInt(it.productId)]).filter(Boolean);
        const nameStr = names.length > 0
          ? (names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`)
          : "Product Sale";
        return notes ? `${nameStr} - ${notes}` : nameStr;
      })(),
      type: "given",
      status: "pending",
      dueDate: null,
    }).returning();
    creditId = credit.id;
  }

  // Create sale record
  const [sale] = await db.insert(productSalesTable).values({
    userId,
    entryId: entry.id,
    creditId,
    customerName: customerName ?? null,
    contactNumber: contactNumber ?? null,
    paymentMethod,
    isCredit: !!isCredit,
    totalAmount: finalAmount.toString(),
    totalProfit: totalProfit.toString(),
    discount: discountAmt.toString(),
    discountType,
    notes: notes ?? null,
    saleDate: saleDate ? new Date(saleDate) : new Date(),
  }).returning();

  // Warranty expiry helper
  function computeWarrantyExpiry(saleDt: Date, period: string, customDays?: number): Date {
    const d = new Date(saleDt);
    switch (period) {
      case "7d":   d.setDate(d.getDate() + 7); break;
      case "1m":   d.setMonth(d.getMonth() + 1); break;
      case "3m":   d.setMonth(d.getMonth() + 3); break;
      case "6m":   d.setMonth(d.getMonth() + 6); break;
      case "custom": d.setDate(d.getDate() + (customDays ?? 0)); break;
    }
    return d;
  }

  const saleDt = saleDate ? new Date(saleDate) : new Date();

  // Insert sale items + decrement stock
  for (let idx = 0; idx < itemDetails.length; idx++) {
    const d = itemDetails[idx];
    const origItem = items[idx];
    const warranty = origItem.warrantyPeriod || null;
    const customDays = origItem.warrantyCustomDays ? parseInt(origItem.warrantyCustomDays) : null;
    const expiryDate = warranty ? computeWarrantyExpiry(saleDt, warranty, customDays ?? undefined) : null;

    await db.insert(productSaleItemsTable).values({
      saleId: sale.id,
      productId: d.productId,
      quantity: d.quantity.toString(),
      purchasePrice: d.purchasePrice.toString(),
      salePrice: d.salePrice.toString(),
      discount: d.itemDiscount.toString(),
      discountType: d.itemDiscountType as any,
      lineTotal: d.lineTotal.toString(),
      profit: d.profit.toString(),
      warrantyPeriod: warranty,
      warrantyCustomDays: customDays,
      warrantyExpiryDate: expiryDate,
    });

    await db.execute(
      sql`UPDATE products SET stock_qty = stock_qty - ${d.quantity} WHERE id = ${d.productId} AND user_id = ${userId}`
    );
  }

  res.status(201).json({ ...formatSale(sale), entryId: entry.id });
});

// Product returns
router.post("/inventory/product-returns", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { saleId, productId, quantity, returnAmount, reason, paymentMethod = "cash", isResalable = false } = req.body;

  if (!productId || !quantity) { res.status(400).json({ error: "Product and quantity required" }); return; }

  const qty = parseFloat(quantity);
  const retAmt = parseFloat(returnAmount ?? 0);

  // Get purchase price for profit reversal
  let profitReversed = 0;
  if (saleId) {
    const [saleItem] = await db.select()
      .from(productSaleItemsTable)
      .where(and(eq(productSaleItemsTable.saleId, parseInt(saleId)), eq(productSaleItemsTable.productId, parseInt(productId))));
    if (saleItem) {
      const sp = parseFloat(saleItem.salePrice as string);
      const pp = parseFloat(saleItem.purchasePrice as string);
      profitReversed = qty * (sp - pp);
    }
  }

  // Restore stock
  await db.execute(
    sql`UPDATE products SET stock_qty = stock_qty + ${qty} WHERE id = ${parseInt(productId)} AND user_id = ${userId}`
  );

  // Create return ledger entry (cash_out)
  if (retAmt > 0) {
    await db.insert(entriesTable).values({
      userId,
      type: "cash_out",
      amount: retAmt.toString(),
      description: `Product Return${reason ? ` - ${reason}` : ""}`,
      paymentMethod: paymentMethod as any,
      profit: (-profitReversed).toString(),
      isCredit: false,
      isFundOperation: false,
      entryDate: new Date(),
    });
  }

  const [ret] = await db.insert(productReturnsTable).values({
    userId,
    saleId: saleId ? parseInt(saleId) : null,
    productId: parseInt(productId),
    quantity: qty.toString(),
    returnAmount: retAmt.toString(),
    profitReversed: profitReversed.toString(),
    reason: reason ?? null,
    isResalable: !!isResalable,
    paymentMethod: paymentMethod as any,
    returnDate: new Date(),
  }).returning();

  res.status(201).json({
    id: ret.id,
    productId: ret.productId,
    quantity: parseFloat(ret.quantity as string),
    returnAmount: parseFloat(ret.returnAmount as string),
    profitReversed: parseFloat(ret.profitReversed as string),
    reason: ret.reason,
    isResalable: ret.isResalable,
    returnDate: ret.returnDate.toISOString(),
  });
});

// Product returns list
router.get("/inventory/product-returns", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const returns = await db
    .select({ ret: productReturnsTable, productName: productsTable.name, productCode: productsTable.code })
    .from(productReturnsTable)
    .leftJoin(productsTable, eq(productReturnsTable.productId, productsTable.id))
    .where(eq(productReturnsTable.userId, userId))
    .orderBy(desc(productReturnsTable.returnDate));

  res.json(returns.map(r => ({
    id: r.ret.id,
    saleId: r.ret.saleId,
    productId: r.ret.productId,
    productName: r.productName,
    productCode: r.productCode,
    quantity: parseFloat(r.ret.quantity as string),
    returnAmount: parseFloat(r.ret.returnAmount as string),
    profitReversed: parseFloat(r.ret.profitReversed as string),
    reason: r.ret.reason,
    isResalable: r.ret.isResalable,
    paymentMethod: r.ret.paymentMethod,
    returnDate: r.ret.returnDate.toISOString(),
  })));
});

// Bill Settings — GET
router.get("/inventory/bill-settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const [settings] = await db.select().from(billSettingsTable).where(eq(billSettingsTable.userId, userId));
  if (!settings) {
    res.json({ shopName: "", address: "", mobile: "", logo: null, footer: "", quickProductShortcut: null });
    return;
  }
  res.json({
    id: settings.id,
    shopName: settings.shopName,
    address: settings.address,
    mobile: settings.mobile,
    logo: settings.logo ?? null,
    footer: settings.footer,
    quickProductShortcut: settings.quickProductShortcut ?? null,
  });
});

// Bill Settings — PATCH (upsert)
router.patch("/inventory/bill-settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { shopName, address, mobile, logo, footer, quickProductShortcut } = req.body;

  const [existing] = await db.select({ id: billSettingsTable.id }).from(billSettingsTable).where(eq(billSettingsTable.userId, userId));

  const data: Record<string, unknown> = {};
  if (shopName !== undefined) data.shopName = shopName;
  if (address !== undefined) data.address = address;
  if (mobile !== undefined) data.mobile = mobile;
  if (logo !== undefined) data.logo = logo;
  if (footer !== undefined) data.footer = footer;
  if (quickProductShortcut !== undefined) data.quickProductShortcut = quickProductShortcut || null;

  if (existing) {
    await db.update(billSettingsTable).set(data).where(eq(billSettingsTable.userId, userId));
  } else {
    await db.insert(billSettingsTable).values({ userId, shopName: shopName ?? "", address: address ?? "", mobile: mobile ?? "", logo: logo ?? null, footer: footer ?? "" });
  }

  const [settings] = await db.select().from(billSettingsTable).where(eq(billSettingsTable.userId, userId));
  res.json({
    shopName: settings.shopName,
    address: settings.address,
    mobile: settings.mobile,
    logo: settings.logo ?? null,
    footer: settings.footer,
    quickProductShortcut: settings.quickProductShortcut ?? null,
  });
});

// Product sales report summary for profits page
router.get("/inventory/product-sales/report/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { dateFrom, dateTo } = req.query;

  const conditions: any[] = [eq(productSalesTable.userId, userId), isNull(productSalesTable.deletedAt)];
  if (dateFrom) conditions.push(gte(productSalesTable.saleDate, new Date(dateFrom as string)));
  if (dateTo) {
    const to = new Date(dateTo as string);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(productSalesTable.saleDate, to));
  }

  const sales = await db.select({
    totalAmount: productSalesTable.totalAmount,
    totalProfit: productSalesTable.totalProfit,
  }).from(productSalesTable).where(and(...conditions));

  const totalRevenue = sales.reduce((s, r) => s + parseFloat(r.totalAmount as string), 0);
  const totalProfit = sales.reduce((s, r) => s + parseFloat(r.totalProfit as string), 0);
  const totalSales = sales.length;

  res.json({ totalRevenue, totalProfit, totalSales });
});

// ── Cancel a sale (reverses all effects) ─────────────────────────────────────
router.post("/inventory/product-sales/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  const { reason } = req.body;

  const [sale] = await db.select().from(productSalesTable)
    .where(and(eq(productSalesTable.id, id), eq(productSalesTable.userId, userId)));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
  if ((sale.status ?? "active") === "cancelled") { res.status(400).json({ error: "Sale already cancelled" }); return; }

  const [actor] = await db.select({ username: usersTable.username, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, userId));

  const items = await db.select().from(productSaleItemsTable)
    .where(eq(productSaleItemsTable.saleId, id));

  const oldSnapshot = {
    status: "active",
    totalAmount: parseFloat(sale.totalAmount as string),
    totalProfit: parseFloat(sale.totalProfit as string),
    isCredit: sale.isCredit,
    paymentMethod: sale.paymentMethod,
    items: items.map(i => ({
      productId: i.productId,
      quantity: parseFloat(i.quantity as string),
      salePrice: parseFloat(i.salePrice as string),
    })),
  };

  // 1. Restore stock
  for (const item of items) {
    const qty = parseFloat(item.quantity as string);
    await db.execute(
      sql`UPDATE products SET stock_qty = stock_qty + ${qty}, updated_at = NOW() WHERE id = ${item.productId} AND user_id = ${userId}`
    );
  }

  // 2. Soft-delete ledger entry (reverses cash/digital balance)
  if (sale.entryId) {
    await db.update(entriesTable).set({ deletedAt: new Date() }).where(eq(entriesTable.id, sale.entryId));
  }

  // 3. Soft-delete credit record if credit sale
  if (sale.creditId) {
    await db.update(creditsTable).set({ deletedAt: new Date() }).where(eq(creditsTable.id, sale.creditId));
  }

  // 4. Mark sale as cancelled
  await db.update(productSalesTable)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: userId })
    .where(eq(productSalesTable.id, id));

  // 5. Log to audit history
  await db.insert(saleEditHistoryTable).values({
    saleId: id,
    userId,
    editType: "cancel",
    oldValues: JSON.stringify(oldSnapshot),
    newValues: JSON.stringify({ status: "cancelled", reason: reason?.trim() ?? null }),
    editedByName: actor?.username ?? "Unknown",
    reason: reason?.trim() ?? null,
  });

  res.json({ success: true, message: `Sale #${id} cancelled. Stock restored.` });
});

// ── Get edit/cancel history for a sale ───────────────────────────────────────
router.get("/inventory/product-sales/:id/history", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);

  const [sale] = await db.select({ id: productSalesTable.id }).from(productSalesTable)
    .where(and(eq(productSalesTable.id, id), eq(productSalesTable.userId, userId)));
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }

  const history = await db.select().from(saleEditHistoryTable)
    .where(eq(saleEditHistoryTable.saleId, id))
    .orderBy(desc(saleEditHistoryTable.createdAt));

  res.json(history.map(h => ({
    id: h.id,
    saleId: h.saleId,
    editType: h.editType,
    oldValues: h.oldValues ? JSON.parse(h.oldValues) : null,
    newValues: h.newValues ? JSON.parse(h.newValues) : null,
    editedByName: h.editedByName ?? null,
    reason: h.reason ?? null,
    createdAt: h.createdAt.toISOString(),
  })));
});

export default router;
