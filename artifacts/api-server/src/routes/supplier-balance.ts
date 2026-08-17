import { Router, type IRouter } from "express";
import { eq, and, desc, sum } from "drizzle-orm";
import { db, companiesTable, purchaseBillsTable, supplierPaymentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { isNull } from "drizzle-orm";

const router: IRouter = Router();

// Get supplier balance for all companies
router.get("/inventory/supplier-balance", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId))
    .orderBy(companiesTable.name);

  // Total purchased per company (from purchase bills with companyId)
  const purchaseTotals = await db
    .select({ companyId: purchaseBillsTable.companyId, total: sum(purchaseBillsTable.totalAmount) })
    .from(purchaseBillsTable)
    .where(and(eq(purchaseBillsTable.userId, userId), isNull(purchaseBillsTable.deletedAt), eq(purchaseBillsTable.isCredit, true)))
    .groupBy(purchaseBillsTable.companyId);

  // Total paid per company
  const paidTotals = await db
    .select({ companyId: supplierPaymentsTable.companyId, total: sum(supplierPaymentsTable.amount) })
    .from(supplierPaymentsTable)
    .where(eq(supplierPaymentsTable.userId, userId))
    .groupBy(supplierPaymentsTable.companyId);

  const purchaseMap = new Map(purchaseTotals.map((p) => [p.companyId, parseFloat(p.total ?? "0")]));
  const paidMap = new Map(paidTotals.map((p) => [p.companyId, parseFloat(p.total ?? "0")]));

  const result = companies.map((c) => {
    const totalPurchase = purchaseMap.get(c.id) ?? 0;
    const paidAmount = paidMap.get(c.id) ?? 0;
    return {
      companyId: c.id,
      companyName: c.name,
      totalPurchase: Math.round(totalPurchase * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      remainingBalance: Math.round((totalPurchase - paidAmount) * 100) / 100,
    };
  });

  res.json(result);
});

// List supplier payments (optionally filter by companyId)
router.get("/inventory/supplier-payments", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { companyId } = req.query;

  const conditions: any[] = [eq(supplierPaymentsTable.userId, userId)];
  if (companyId) conditions.push(eq(supplierPaymentsTable.companyId, parseInt(companyId as string)));

  const rows = await db
    .select({ payment: supplierPaymentsTable, companyName: companiesTable.name })
    .from(supplierPaymentsTable)
    .leftJoin(companiesTable, eq(supplierPaymentsTable.companyId, companiesTable.id))
    .where(and(...conditions))
    .orderBy(desc(supplierPaymentsTable.paymentDate));

  res.json(rows.map((r) => ({
    id: r.payment.id,
    userId: r.payment.userId,
    companyId: r.payment.companyId,
    companyName: r.companyName ?? null,
    amount: parseFloat(r.payment.amount),
    paymentMethod: r.payment.paymentMethod ?? "cash",
    billId: r.payment.billId ?? null,
    paymentDate: r.payment.paymentDate.toISOString(),
    notes: r.payment.notes ?? null,
    createdAt: r.payment.createdAt.toISOString(),
  })));
});

// Record a supplier payment
router.post("/inventory/supplier-payments", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const { companyId, amount, paymentDate, notes, paymentMethod, billId } = req.body;

  if (!companyId || !amount || !paymentDate) {
    res.status(400).json({ error: "companyId, amount, paymentDate required" }); return;
  }

  const [payment] = await db.insert(supplierPaymentsTable).values({
    userId,
    companyId: parseInt(companyId),
    amount: parseFloat(amount).toString(),
    paymentMethod: (paymentMethod === "digital" ? "digital" : "cash") as "cash" | "digital",
    billId: billId ? parseInt(billId) : null,
    paymentDate: new Date(paymentDate),
    notes: notes?.trim() || null,
  }).returning();

  res.status(201).json({
    id: payment.id,
    userId: payment.userId,
    companyId: payment.companyId,
    amount: parseFloat(payment.amount),
    paymentMethod: payment.paymentMethod,
    billId: payment.billId ?? null,
    paymentDate: payment.paymentDate.toISOString(),
    notes: payment.notes ?? null,
    createdAt: payment.createdAt.toISOString(),
  });
});

// Delete a payment
router.delete("/inventory/supplier-payments/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const id = parseInt(req.params.id);
  await db.delete(supplierPaymentsTable)
    .where(and(eq(supplierPaymentsTable.id, id), eq(supplierPaymentsTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
