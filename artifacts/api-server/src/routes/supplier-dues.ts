/**
 * Supplier Dues — compute remaining balance per company (total billed - total paid).
 * GET /api/inventory/supplier-dues
 */
import { Router, type IRouter } from "express";
import { eq, and, isNull, sum, sql } from "drizzle-orm";
import { db, purchaseBillsTable, supplierPaymentsTable, companiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/inventory/supplier-dues", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  // Get all companies for this user
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId));

  const dues = await Promise.all(companies.map(async (co) => {
    // Sum of purchase bills for this company
    const [billSum] = await db
      .select({ total: sum(purchaseBillsTable.totalAmount) })
      .from(purchaseBillsTable)
      .where(and(
        eq(purchaseBillsTable.userId, userId),
        eq(purchaseBillsTable.companyId, co.id),
        isNull(purchaseBillsTable.deletedAt),
      ));

    // Sum of payments for this company
    const [paidSum] = await db
      .select({ total: sum(supplierPaymentsTable.amount) })
      .from(supplierPaymentsTable)
      .where(and(
        eq(supplierPaymentsTable.userId, userId),
        eq(supplierPaymentsTable.companyId, co.id),
      ));

    const totalBilled = parseFloat(billSum?.total ?? "0");
    const totalPaid = parseFloat(paidSum?.total ?? "0");
    const remaining = totalBilled - totalPaid;

    return {
      companyId: co.id,
      companyName: co.name,
      totalBilled,
      totalPaid,
      remaining,
    };
  }));

  // Return only companies with a remaining balance > 0
  const withDues = dues.filter(d => d.remaining > 0);

  // Sort by remaining desc
  withDues.sort((a, b) => b.remaining - a.remaining);

  res.json(withDues);
});

export default router;
