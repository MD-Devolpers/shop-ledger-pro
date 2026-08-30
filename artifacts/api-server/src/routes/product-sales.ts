import { Router, type IRouter } from "express";
import { eq, and, or, desc, asc, isNull, ilike, gte, lte, sql, inArray } from "drizzle-orm";
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
  const creation = await db.transaction(async (tx) => {
  for (const d of [...itemDetails].sort((a, b) => a.productId - b.productId)) {
    const result = await tx.execute(sql`
      UPDATE products
      SET stock_qty = stock_qty - ${d.quantity}, updated_at = NOW()
      WHERE id = ${d.productId} AND user_id = ${userId}
        AND deleted_at IS NULL AND stock_qty >= ${d.quantity}
      RETURNING id
    `);
    if (result.rowCount !== 1) throw new Error(`Insufficient stock for product ${d.productId}`);
  }

  const [entry] = await tx.insert(entriesTable).values({
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
    const [credit] = await tx.insert(creditsTable).values({
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
  const [sale] = await tx.insert(productSalesTable).values({
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

    await tx.insert(productSaleItemsTable).values({
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

  }

  return { sale, entry };
  }).catch(error => ({ error: error instanceof Error ? error.message : "Sale creation failed" }));

  if ("error" in creation) { res.status(400).json({ error: creation.error }); return; }
  res.status(201).json({ ...formatSale(creation.sale), entryId: creation.entry.id });
});

// Edit a sale and reconcile every linked accounting/stock effect atomically.
router.patch("/inventory/product-sales/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id, 10);
  const {
    customerName, contactNumber, paymentMethod = "cash", isCredit = false,
    discount = 0, discountType = "fixed", notes, saleDate, items, reason,
  } = req.body;

  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid sale ID" }); return; }
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one product is required" }); return;
  }
  if (!["cash", "digital"].includes(paymentMethod) || !["fixed", "percent"].includes(discountType)) {
    res.status(400).json({ error: "Invalid payment or discount type" }); return;
  }
  if (isCredit && !String(customerName ?? "").trim()) {
    res.status(400).json({ error: "Customer name is required for a credit sale" }); return;
  }
  const parsedSaleDate = saleDate ? new Date(saleDate) : new Date();
  if (Number.isNaN(parsedSaleDate.getTime())) {
    res.status(400).json({ error: "Invalid sale date" }); return;
  }

  const parsedItems = items.map((item: any) => ({
    productId: Number(item.productId),
    quantity: Number(item.quantity),
    salePrice: Number(item.salePrice),
    discount: Number(item.discount ?? 0),
    discountType: item.discountType ?? "fixed",
  }));
  const invalidItem = parsedItems.find(item =>
    !Number.isInteger(item.productId) ||
    !Number.isFinite(item.quantity) || item.quantity <= 0 ||
    !Number.isFinite(item.salePrice) || item.salePrice < 0 ||
    !Number.isFinite(item.discount) || item.discount < 0 ||
    !["fixed", "percent"].includes(item.discountType)
  );
  if (invalidItem || new Set(parsedItems.map(item => item.productId)).size !== parsedItems.length) {
    res.status(400).json({ error: invalidItem ? "Every product needs a valid quantity, price, and discount" : "The same product cannot appear twice" });
    return;
  }
  const overallDiscount = Number(discount);
  if (!Number.isFinite(overallDiscount) || overallDiscount < 0 || (discountType === "percent" && overallDiscount > 100)) {
    res.status(400).json({ error: "Invalid overall discount" }); return;
  }

  const [actor] = await db.select({ username: usersTable.username })
    .from(usersTable).where(eq(usersTable.id, userId));

  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM product_sales WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`);
    const [sale] = await tx.select().from(productSalesTable)
      .where(and(eq(productSalesTable.id, id), eq(productSalesTable.userId, userId), isNull(productSalesTable.deletedAt)));
    if (!sale) return { error: "Sale not found", status: 404 } as const;
    if ((sale.status ?? "active") === "cancelled") return { error: "A cancelled sale cannot be edited", status: 400 } as const;

    const existingReturn = await tx.select({ id: productReturnsTable.id }).from(productReturnsTable)
      .where(and(eq(productReturnsTable.userId, userId), eq(productReturnsTable.saleId, id))).limit(1);
    if (existingReturn.length > 0) {
      return { error: "A sale with product returns cannot be edited", status: 400 } as const;
    }
    if (sale.creditId) {
      await tx.execute(sql`SELECT id FROM credits WHERE id = ${sale.creditId} AND user_id = ${userId} FOR UPDATE`);
      const [linkedCredit] = await tx.select({ status: creditsTable.status }).from(creditsTable)
        .where(and(eq(creditsTable.id, sale.creditId), eq(creditsTable.userId, userId)));
      if (linkedCredit?.status === "paid") {
        return { error: "A settled credit sale cannot be edited", status: 400 } as const;
      }
    }

    const oldItems = await tx.select().from(productSaleItemsTable).where(eq(productSaleItemsTable.saleId, id));
    const oldQuantityByProduct = new Map<number, number>();
    const oldItemByProduct = new Map<number, typeof oldItems[number]>();
    for (const item of oldItems) {
      oldQuantityByProduct.set(item.productId, (oldQuantityByProduct.get(item.productId) ?? 0) + Number(item.quantity));
      oldItemByProduct.set(item.productId, item);
    }

    const allProductIds = [...new Set([...oldQuantityByProduct.keys(), ...parsedItems.map(item => item.productId)])].sort((a, b) => a - b);
    const productsById = new Map<number, typeof productsTable.$inferSelect>();
    for (const productId of allProductIds) {
      await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} AND user_id = ${userId} FOR UPDATE`);
      const [product] = await tx.select().from(productsTable)
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));
      if (!product) return { error: `Product ${productId} not found`, status: 400 } as const;
      productsById.set(productId, product);
    }

    let subtotal = 0;
    let totalProfit = 0;
    const newDetails = parsedItems.map(item => {
      const product = productsById.get(item.productId)!;
      const oldItem = oldItemByProduct.get(item.productId);
      const available = Number(product.stockQty) + (oldQuantityByProduct.get(item.productId) ?? 0);
      if (item.quantity > available) throw new Error(`Insufficient stock for ${product.name}. Available: ${available}`);
      if (item.discountType === "percent" && item.discount > 100) throw new Error(`Discount for ${product.name} cannot exceed 100%`);
      const gross = item.quantity * item.salePrice;
      if (item.discountType === "fixed" && item.discount > gross) throw new Error(`Discount for ${product.name} cannot exceed its line total`);
      const lineTotal = item.discountType === "percent" ? gross * (1 - item.discount / 100) : gross - item.discount;
      const purchasePrice = oldItem ? Number(oldItem.purchasePrice) : Number(product.purchasePrice);
      const profit = lineTotal - item.quantity * purchasePrice;
      subtotal += lineTotal;
      totalProfit += profit;
      return { ...item, product, oldItem, purchasePrice, lineTotal, profit };
    });
    const finalAmount = discountType === "percent" ? subtotal * (1 - overallDiscount / 100) : subtotal - overallDiscount;
    if (finalAmount < 0) return { error: "Overall discount cannot exceed the sale subtotal", status: 400 } as const;

    for (const productId of allProductIds) {
      const oldQty = oldQuantityByProduct.get(productId) ?? 0;
      const newQty = newDetails.find(item => item.productId === productId)?.quantity ?? 0;
      const delta = oldQty - newQty;
      if (delta !== 0) {
        await tx.execute(sql`UPDATE products SET stock_qty = stock_qty + ${delta}, updated_at = NOW() WHERE id = ${productId} AND user_id = ${userId}`);
      }
    }

    await tx.delete(productSaleItemsTable).where(eq(productSaleItemsTable.saleId, id));
    for (const detail of newDetails) {
      await tx.insert(productSaleItemsTable).values({
        saleId: id,
        productId: detail.productId,
        quantity: detail.quantity.toString(),
        purchasePrice: detail.purchasePrice.toString(),
        salePrice: detail.salePrice.toString(),
        discount: detail.discount.toString(),
        discountType: detail.discountType as "fixed" | "percent",
        lineTotal: detail.lineTotal.toString(),
        profit: detail.profit.toString(),
        warrantyPeriod: detail.oldItem?.warrantyPeriod ?? null,
        warrantyCustomDays: detail.oldItem?.warrantyCustomDays ?? null,
        warrantyExpiryDate: detail.oldItem?.warrantyExpiryDate ?? null,
      });
    }

    const cleanCustomerName = String(customerName ?? "").trim() || null;
    const cleanContactNumber = String(contactNumber ?? "").trim() || null;
    const cleanNotes = String(notes ?? "").trim() || null;
    const productLabel = newDetails.length === 1 ? newDetails[0].product.name : `${newDetails[0].product.name} +${newDetails.length - 1} more`;
    const entryDescription = `${productLabel}${cleanCustomerName ? ` - ${cleanCustomerName}` : ""}`;
    const creditDescription = cleanNotes ? `${productLabel} - ${cleanNotes}` : productLabel;

    if (sale.entryId) {
      await tx.update(entriesTable).set({
        amount: finalAmount.toString(), description: entryDescription,
        paymentMethod: isCredit ? "cash" : paymentMethod, profit: totalProfit.toString(),
        isCredit: !!isCredit, customerName: cleanCustomerName, contactNumber: cleanContactNumber,
        entryDate: parsedSaleDate,
      }).where(and(eq(entriesTable.id, sale.entryId), eq(entriesTable.userId, userId)));
    }

    let nextCreditId = sale.creditId;
    if (isCredit && cleanCustomerName) {
      if (sale.creditId) {
        await tx.update(creditsTable).set({
          customerName: cleanCustomerName, phone: cleanContactNumber, amount: finalAmount.toString(),
          description: creditDescription, deletedAt: null,
        }).where(and(eq(creditsTable.id, sale.creditId), eq(creditsTable.userId, userId)));
      } else {
        const [credit] = await tx.insert(creditsTable).values({
          userId, customerName: cleanCustomerName, phone: cleanContactNumber,
          amount: finalAmount.toString(), description: creditDescription, type: "given", status: "pending",
        }).returning();
        nextCreditId = credit.id;
      }
    } else if (sale.creditId) {
      await tx.update(creditsTable).set({ deletedAt: new Date() })
        .where(and(eq(creditsTable.id, sale.creditId), eq(creditsTable.userId, userId)));
      nextCreditId = null;
    }

    const oldSnapshot = {
      customerName: sale.customerName, contactNumber: sale.contactNumber, paymentMethod: sale.paymentMethod,
      isCredit: sale.isCredit, totalAmount: Number(sale.totalAmount), totalProfit: Number(sale.totalProfit),
      discount: Number(sale.discount), discountType: sale.discountType, notes: sale.notes, saleDate: sale.saleDate.toISOString(),
      items: oldItems.map(item => ({ productId: item.productId, quantity: Number(item.quantity), salePrice: Number(item.salePrice), discount: Number(item.discount), discountType: item.discountType })),
    };
    const [updatedSale] = await tx.update(productSalesTable).set({
      creditId: nextCreditId, customerName: cleanCustomerName, contactNumber: cleanContactNumber,
      paymentMethod, isCredit: !!isCredit, totalAmount: finalAmount.toString(), totalProfit: totalProfit.toString(),
      discount: overallDiscount.toString(), discountType, notes: cleanNotes, saleDate: parsedSaleDate,
    }).where(and(eq(productSalesTable.id, id), eq(productSalesTable.userId, userId))).returning();
    if (!updatedSale) return { error: "Sale update failed", status: 500 } as const;
    const newSnapshot = {
      customerName: cleanCustomerName, contactNumber: cleanContactNumber, paymentMethod, isCredit: !!isCredit,
      totalAmount: finalAmount, totalProfit, discount: overallDiscount, discountType, notes: cleanNotes,
      saleDate: parsedSaleDate.toISOString(),
      items: newDetails.map(item => ({ productId: item.productId, quantity: item.quantity, salePrice: item.salePrice, discount: item.discount, discountType: item.discountType })),
    };
    await tx.insert(saleEditHistoryTable).values({
      saleId: id, userId, editType: "edit", oldValues: JSON.stringify(oldSnapshot),
      newValues: JSON.stringify(newSnapshot), editedByName: actor?.username ?? "Unknown",
      reason: String(reason ?? "").trim() || null,
    });
    return { sale: updatedSale } as const;
  }).catch(error => ({ error: error instanceof Error ? error.message : "Sale update failed", status: 400 } as const));

  if (!("sale" in outcome)) { res.status(outcome.status).json({ error: outcome.error }); return; }
  const savedSale = outcome.sale;
  if (!savedSale) { res.status(500).json({ error: "Sale update failed" }); return; }
  const itemRows = await db.select({ item: productSaleItemsTable, productName: productsTable.name, productCode: productsTable.code })
    .from(productSaleItemsTable).leftJoin(productsTable, eq(productSaleItemsTable.productId, productsTable.id))
    .where(eq(productSaleItemsTable.saleId, id));
  res.json({
    ...formatSale(savedSale),
    items: itemRows.map(row => formatSaleItem({ ...row.item, productName: row.productName ?? undefined, productCode: row.productCode ?? undefined })),
  });
});

// Product returns
router.post("/inventory/product-returns", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { saleId, productId, quantity, reason, paymentMethod = "cash", isResalable = true } = req.body;

  if (!saleId || !productId || !quantity) {
    res.status(400).json({ error: "Original sale, product and quantity are required" });
    return;
  }

  const qty = parseFloat(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    res.status(400).json({ error: "Return quantity must be greater than zero" });
    return;
  }
  if (!Number.isInteger(qty)) {
    res.status(400).json({ error: "Return quantity must be a whole number (1, 2, 3...)" });
    return;
  }

  const parsedSaleId = parseInt(saleId);
  const parsedProductId = parseInt(productId);
  if (!Number.isInteger(parsedSaleId) || !Number.isInteger(parsedProductId)) {
    res.status(400).json({ error: "Invalid sale or product" });
    return;
  }

  const outcome = await db.transaction(async (tx) => {
    // Lock the sale while calculating remaining quantity so concurrent returns
    // cannot both refund the same sold units.
    await tx.execute(sql`SELECT id FROM product_sales WHERE id = ${parsedSaleId} AND user_id = ${userId} FOR UPDATE`);
    const [lockedSale] = await tx.select()
      .from(productSalesTable)
      .where(and(eq(productSalesTable.id, parsedSaleId), eq(productSalesTable.userId, userId)));
    if (!lockedSale || lockedSale.deletedAt || (lockedSale.status ?? "active") !== "active") {
      return { error: "Original sale is not available for return" };
    }
    const [lockedSaleItem] = await tx.select().from(productSaleItemsTable)
      .where(and(eq(productSaleItemsTable.saleId, parsedSaleId), eq(productSaleItemsTable.productId, parsedProductId)));
    if (!lockedSaleItem) return { error: "This product was not part of the selected sale" };
    const soldQty = parseFloat(lockedSaleItem.quantity as string);
    const lockedSaleItems = await tx.select({ lineTotal: productSaleItemsTable.lineTotal })
      .from(productSaleItemsTable).where(eq(productSaleItemsTable.saleId, parsedSaleId));
    const saleLinesTotal = lockedSaleItems.reduce((total, item) => total + parseFloat(item.lineTotal as string), 0);
    const itemLineTotal = parseFloat(lockedSaleItem.lineTotal as string);
    const saleAmount = parseFloat(lockedSale.totalAmount as string);
    const paidLineTotal = saleLinesTotal > 0 ? itemLineTotal * (saleAmount / saleLinesTotal) : itemLineTotal;
    const returnAmount = Math.round((qty * (paidLineTotal / soldQty)) * 100) / 100;
    const purchaseCost = qty * parseFloat(lockedSaleItem.purchasePrice as string);
    const profitReversed = Math.round((returnAmount - purchaseCost) * 100) / 100;

    const previousReturns = await tx.select({ quantity: productReturnsTable.quantity })
      .from(productReturnsTable)
      .where(and(
        eq(productReturnsTable.userId, userId),
        eq(productReturnsTable.saleId, parsedSaleId),
        eq(productReturnsTable.productId, parsedProductId),
      ));
    const alreadyReturned = previousReturns.reduce((total, item) => total + parseFloat(item.quantity as string), 0);
    const remainingQty = Math.max(0, soldQty - alreadyReturned);
    if (qty > remainingQty + 0.000001) {
      return { error: `Only ${remainingQty} item(s) are eligible for return from this sale` };
    }

    await tx.execute(
      sql`UPDATE products SET stock_qty = stock_qty + ${qty} WHERE id = ${parsedProductId} AND user_id = ${userId}`
    );

    if (returnAmount > 0) {
      await tx.insert(entriesTable).values({
        userId,
        type: "cash_out",
        amount: returnAmount.toString(),
        description: `Product Return — Sale #${parsedSaleId}${reason ? ` - ${reason}` : ""}`,
        paymentMethod: paymentMethod as any,
        profit: (-profitReversed).toString(),
        isCredit: false,
        isFundOperation: false,
        source: "product_sale",
        entryDate: new Date(),
      });
    }

    const [record] = await tx.insert(productReturnsTable).values({
      userId,
      saleId: parsedSaleId,
      productId: parsedProductId,
      quantity: qty.toString(),
      returnAmount: returnAmount.toString(),
      profitReversed: profitReversed.toString(),
      reason: reason ?? null,
      isResalable: !!isResalable,
      paymentMethod: paymentMethod as any,
      returnDate: new Date(),
    }).returning();
    return { record };
  });
  if ("error" in outcome) {
    res.status(400).json({ error: outcome.error });
    return;
  }
  const ret = outcome.record;

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

router.post("/inventory/product-returns/bulk", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { productId, quantity, reason, paymentMethod = "cash", isResalable = true } = req.body;
  const parsedProductId = parseInt(productId);
  const qty = parseFloat(quantity);

  if (!Number.isInteger(parsedProductId) || !Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    res.status(400).json({ error: "Product and a whole return quantity are required" });
    return;
  }

  const [product] = await db.select({ name: productsTable.name })
    .from(productsTable)
    .where(and(eq(productsTable.id, parsedProductId), eq(productsTable.userId, userId)));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const outcome = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ sale: productSalesTable, item: productSaleItemsTable })
      .from(productSalesTable)
      .innerJoin(productSaleItemsTable, eq(productSaleItemsTable.saleId, productSalesTable.id))
      .where(and(
        eq(productSalesTable.userId, userId),
        eq(productSaleItemsTable.productId, parsedProductId),
        isNull(productSalesTable.deletedAt),
        or(isNull(productSalesTable.status), eq(productSalesTable.status, "active")),
      ))
      .orderBy(asc(productSalesTable.saleDate), asc(productSalesTable.id));

    const allocations: Array<{
      saleId: number;
      quantity: number;
      returnAmount: number;
      profitReversed: number;
    }> = [];
    let remainingToReturn = qty;

    for (const candidate of candidates) {
      if (remainingToReturn <= 0) break;
      await tx.execute(sql`SELECT id FROM product_sales WHERE id = ${candidate.sale.id} AND user_id = ${userId} FOR UPDATE`);
      const [lockedCandidate] = await tx
        .select({ sale: productSalesTable, item: productSaleItemsTable })
        .from(productSalesTable)
        .innerJoin(productSaleItemsTable, eq(productSaleItemsTable.saleId, productSalesTable.id))
        .where(and(
          eq(productSalesTable.id, candidate.sale.id),
          eq(productSalesTable.userId, userId),
          eq(productSaleItemsTable.productId, parsedProductId),
          isNull(productSalesTable.deletedAt),
          or(isNull(productSalesTable.status), eq(productSalesTable.status, "active")),
        ));
      if (!lockedCandidate) continue;

      const previousReturns = await tx.select({ quantity: productReturnsTable.quantity })
        .from(productReturnsTable)
        .where(and(
          eq(productReturnsTable.userId, userId),
          eq(productReturnsTable.saleId, candidate.sale.id),
          eq(productReturnsTable.productId, parsedProductId),
        ));
      const alreadyReturned = previousReturns.reduce((total, item) => total + parseFloat(item.quantity as string), 0);
      const soldQty = parseFloat(lockedCandidate.item.quantity as string);
      const availableQty = Math.max(0, soldQty - alreadyReturned);
      if (availableQty <= 0) continue;

      const allSaleItems = await tx.select({ lineTotal: productSaleItemsTable.lineTotal })
        .from(productSaleItemsTable)
        .where(eq(productSaleItemsTable.saleId, candidate.sale.id));
      const saleLinesTotal = allSaleItems.reduce((total, item) => total + parseFloat(item.lineTotal as string), 0);
      const itemLineTotal = parseFloat(lockedCandidate.item.lineTotal as string);
      const saleAmount = parseFloat(lockedCandidate.sale.totalAmount as string);
      const paidLineTotal = saleLinesTotal > 0 ? itemLineTotal * (saleAmount / saleLinesTotal) : itemLineTotal;
      const refundPerUnit = soldQty > 0 ? paidLineTotal / soldQty : 0;
      const allocatedQty = Math.min(remainingToReturn, availableQty);
      const returnAmount = Math.round(allocatedQty * refundPerUnit * 100) / 100;
      const purchaseCost = allocatedQty * parseFloat(lockedCandidate.item.purchasePrice as string);
      const profitReversed = Math.round((returnAmount - purchaseCost) * 100) / 100;

      allocations.push({ saleId: candidate.sale.id, quantity: allocatedQty, returnAmount, profitReversed });
      remainingToReturn -= allocatedQty;
    }

    if (remainingToReturn > 0.000001) {
      return { error: `Only ${qty - remainingToReturn} item(s) are eligible for return` };
    }

    const totalReturnAmount = Math.round(allocations.reduce((total, item) => total + item.returnAmount, 0) * 100) / 100;
    const totalProfitReversed = Math.round(allocations.reduce((total, item) => total + item.profitReversed, 0) * 100) / 100;

    await tx.execute(
      sql`UPDATE products SET stock_qty = stock_qty + ${qty} WHERE id = ${parsedProductId} AND user_id = ${userId}`
    );
    if (totalReturnAmount > 0) {
      await tx.insert(entriesTable).values({
        userId,
        type: "cash_out",
        amount: totalReturnAmount.toString(),
        description: `Product Return — ${product.name}${reason ? ` - ${reason}` : ""}`,
        paymentMethod: paymentMethod as any,
        profit: (-totalProfitReversed).toString(),
        isCredit: false,
        isFundOperation: false,
        source: "product_sale",
        entryDate: new Date(),
      });
    }

    for (const allocation of allocations) {
      await tx.insert(productReturnsTable).values({
        userId,
        saleId: allocation.saleId,
        productId: parsedProductId,
        quantity: allocation.quantity.toString(),
        returnAmount: allocation.returnAmount.toString(),
        profitReversed: allocation.profitReversed.toString(),
        reason: reason ?? null,
        isResalable: !!isResalable,
        paymentMethod: paymentMethod as any,
        returnDate: new Date(),
      });
    }
    return { totalReturnAmount, totalProfitReversed, saleCount: allocations.length };
  });

  if ("error" in outcome) {
    res.status(400).json({ error: outcome.error });
    return;
  }
  res.status(201).json({
    quantity: qty,
    returnAmount: outcome.totalReturnAmount,
    profitReversed: outcome.totalProfitReversed,
    saleCount: outcome.saleCount,
    paymentMethod,
  });
});

// Product returns list
router.get("/inventory/product-returns", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { dateFrom, dateTo } = req.query;
  const conditions: any[] = [eq(productReturnsTable.userId, userId)];
  if (dateFrom) conditions.push(gte(productReturnsTable.returnDate, new Date(dateFrom as string)));
  if (dateTo) {
    const to = new Date(dateTo as string);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(productReturnsTable.returnDate, to));
  }
  const returns = await db
    .select({ ret: productReturnsTable, productName: productsTable.name, productCode: productsTable.code })
    .from(productReturnsTable)
    .leftJoin(productsTable, eq(productReturnsTable.productId, productsTable.id))
    .where(and(...conditions))
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
  const { reason } = req.body ?? {};

  const [actor] = await db.select({ username: usersTable.username, role: usersTable.role })
    .from(usersTable).where(eq(usersTable.id, userId));

  const outcome = await db.transaction(async (tx) => {
    // Returns lock this same sale row, so a cancellation and a return cannot
    // both restore the same stock.
    await tx.execute(sql`SELECT id FROM product_sales WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`);
    const [sale] = await tx.select().from(productSalesTable)
      .where(and(eq(productSalesTable.id, id), eq(productSalesTable.userId, userId)));
    if (!sale) return { error: "Sale not found", status: 404 };
    if ((sale.status ?? "active") === "cancelled") return { error: "Sale already cancelled", status: 400 };
    const existingReturn = await tx.select({ id: productReturnsTable.id })
      .from(productReturnsTable)
      .where(and(eq(productReturnsTable.userId, userId), eq(productReturnsTable.saleId, id)))
      .limit(1);
    if (existingReturn.length > 0) {
      return { error: "A sale with product returns cannot be cancelled", status: 400 };
    }
    if (sale.creditId) {
      await tx.execute(sql`SELECT id FROM credits WHERE id = ${sale.creditId} AND user_id = ${userId} FOR UPDATE`);
      const [linkedCredit] = await tx.select({ status: creditsTable.status }).from(creditsTable)
        .where(and(eq(creditsTable.id, sale.creditId), eq(creditsTable.userId, userId)));
      if (linkedCredit?.status === "paid") {
        return { error: "A settled credit sale cannot be cancelled", status: 400 };
      }
    }

    const items = await tx.select().from(productSaleItemsTable)
      .where(eq(productSaleItemsTable.saleId, id));
    const oldSnapshot = {
      status: "active",
      totalAmount: parseFloat(sale.totalAmount as string),
      totalProfit: parseFloat(sale.totalProfit as string),
      isCredit: sale.isCredit,
      paymentMethod: sale.paymentMethod,
      items: items.map(item => ({
        productId: item.productId,
        quantity: parseFloat(item.quantity as string),
        salePrice: parseFloat(item.salePrice as string),
      })),
    };

    for (const item of items) {
      const qty = parseFloat(item.quantity as string);
      await tx.execute(
        sql`UPDATE products SET stock_qty = stock_qty + ${qty}, updated_at = NOW() WHERE id = ${item.productId} AND user_id = ${userId}`
      );
    }
    if (sale.entryId) {
      await tx.update(entriesTable).set({ deletedAt: new Date() }).where(eq(entriesTable.id, sale.entryId));
    }
    if (sale.creditId) {
      await tx.update(creditsTable).set({ deletedAt: new Date() }).where(eq(creditsTable.id, sale.creditId));
    }
    await tx.update(productSalesTable)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: userId })
      .where(eq(productSalesTable.id, id));
    await tx.insert(saleEditHistoryTable).values({
      saleId: id,
      userId,
      editType: "cancel",
      oldValues: JSON.stringify(oldSnapshot),
      newValues: JSON.stringify({ status: "cancelled", reason: reason?.trim() ?? null }),
      editedByName: actor?.username ?? "Unknown",
      reason: reason?.trim() ?? null,
    });
    return { success: true };
  });

  if (!outcome.success) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
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
