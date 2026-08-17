/**
 * Warranty Check — look up sale items + warranty info by sale ID.
 * GET /api/inventory/warranty-check/:saleId
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, productSalesTable, productSaleItemsTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/inventory/warranty-check/:saleId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const saleId = parseInt(req.params.saleId);

  if (isNaN(saleId)) {
    res.status(400).json({ error: "Valid sale ID (invoice number) enter karein" });
    return;
  }

  // Find the sale
  const [sale] = await db
    .select()
    .from(productSalesTable)
    .where(and(eq(productSalesTable.id, saleId), eq(productSalesTable.userId, userId)));

  if (!sale) {
    res.status(404).json({ error: `Invoice #${saleId} nahi mila` });
    return;
  }

  // Get items with warranty info
  const items = await db
    .select({
      item: productSaleItemsTable,
      productName: productsTable.name,
      productCode: productsTable.code,
    })
    .from(productSaleItemsTable)
    .leftJoin(productsTable, eq(productSaleItemsTable.productId, productsTable.id))
    .where(eq(productSaleItemsTable.saleId, saleId));

  const warrantyItems = items
    .filter(r => r.item.warrantyPeriod)
    .map(r => ({
      itemId: r.item.id,
      productId: r.item.productId,
      productName: r.productName ?? "Unknown",
      productCode: r.productCode ?? "",
      quantity: parseFloat(r.item.quantity),
      warrantyPeriod: r.item.warrantyPeriod,
      warrantyCustomDays: r.item.warrantyCustomDays,
      warrantyExpiryDate: r.item.warrantyExpiryDate,
      isExpired: r.item.warrantyExpiryDate ? new Date(r.item.warrantyExpiryDate) < new Date() : null,
    }));

  res.json({
    saleId: sale.id,
    saleDate: sale.saleDate,
    customerName: sale.customerName,
    contactNumber: sale.contactNumber,
    status: sale.status,
    warrantyItems,
    totalItems: items.length,
    itemsWithWarranty: warrantyItems.length,
  });
});

export default router;
