import { Router, type IRouter } from "express";
import { eq, and, gte, lte, isNull, sum, count, sql } from "drizzle-orm";
import { db, entriesTable, creditsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function getDateRange(period: string, date?: string): { start: Date; end: Date } {
  const ref = date ? new Date(date) : new Date();
  const start = new Date(ref);
  const end = new Date(ref);

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "yesterday") {
    start.setDate(ref.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(ref.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    const day = ref.getDay();
    start.setDate(ref.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(ref.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function formatEntry(e: typeof entriesTable.$inferSelect) {
  return {
    id: e.id,
    userId: e.userId,
    type: e.type,
    amount: parseFloat(e.amount),
    description: e.description,
    paymentMethod: e.paymentMethod,
    profit: e.profit != null ? parseFloat(e.profit) : null,
    isCredit: e.isCredit,
    customerName: e.customerName,
    deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
    entryDate: e.entryDate.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/reports/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;

  const userEntries = await db
    .select()
    .from(entriesTable)
    .where(and(eq(entriesTable.userId, userId), isNull(entriesTable.deletedAt)));

  let cashBalance = 0;
  let digitalBalance = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalProfit = 0;
  let totalCreditGiven = 0;
  let totalCreditReceived = 0;

  for (const entry of userEntries) {
    const amount = parseFloat(entry.amount);
    const profit = entry.profit ? parseFloat(entry.profit) : 0;
    totalProfit += profit;

    // Credit entries do NOT count toward cash/digital balance
    if (entry.isCredit) {
      if (entry.type === "cash_in") {
        totalCreditGiven += amount; // someone owes you
      } else {
        totalCreditReceived += amount; // you owe someone
      }
      continue;
    }

    if (entry.paymentMethod === "cash") {
      if (entry.type === "cash_in") {
        cashBalance += amount;
        totalCashIn += amount;
      } else {
        cashBalance -= amount;
        totalCashOut += amount;
      }
    } else {
      if (entry.type === "cash_in") {
        digitalBalance += amount;
        totalCashIn += amount;
      } else {
        digitalBalance -= amount;
        totalCashOut += amount;
      }
    }
  }

  // Calculate credit balances from the credits table (live, reflects all payments)
  const pendingCredits = await db
    .select({ type: creditsTable.type, totalAmount: sum(creditsTable.amount) })
    .from(creditsTable)
    .where(and(eq(creditsTable.userId, userId), eq(creditsTable.status, "pending")))
    .groupBy(creditsTable.type);

  const pendingGiven = parseFloat(
    pendingCredits.find((c) => c.type === "given")?.totalAmount ?? "0"
  );
  const pendingReceived = parseFloat(
    pendingCredits.find((c) => c.type === "received")?.totalAmount ?? "0"
  );

  // totalCredit = money customers owe you (pending given credits only)
  const totalCredit = pendingGiven;
  // creditBalance = net: owed to you minus you owe others
  const creditBalance = pendingGiven - pendingReceived;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const todayCount = userEntries.filter((e) => {
    const d = new Date(e.entryDate);
    return d >= today && d <= todayEnd;
  }).length;

  res.json({
    cashBalance: Math.round(cashBalance * 100) / 100,
    digitalBalance: Math.round(digitalBalance * 100) / 100,
    totalBalance: Math.round((cashBalance + digitalBalance) * 100) / 100,
    totalCashIn: Math.round(totalCashIn * 100) / 100,
    totalCashOut: Math.round(totalCashOut * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    creditBalance: Math.round(creditBalance * 100) / 100,
    totalCreditGiven: Math.round(totalCreditGiven * 100) / 100,
    totalCreditReceived: Math.round(totalCreditReceived * 100) / 100,
    todayEntries: todayCount,
  });
});

router.get("/reports/entries", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const period = req.query.period as string;
  const date = req.query.date as string | undefined;

  if (!period || !["daily", "weekly", "monthly"].includes(period)) {
    res.status(400).json({ error: "Invalid period. Use daily, weekly, or monthly" });
    return;
  }

  const { start, end } = getDateRange(period, date);

  const entries = await db
    .select()
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.userId, userId),
        isNull(entriesTable.deletedAt),
        gte(entriesTable.entryDate, start),
        lte(entriesTable.entryDate, end)
      )
    )
    .orderBy(entriesTable.entryDate);

  let cashIn = 0;
  let cashOut = 0;
  let cashBalance = 0;
  let digitalBalance = 0;

  for (const entry of entries) {
    const amount = parseFloat(entry.amount);
    if (entry.type === "cash_in") {
      cashIn += amount;
      if (entry.paymentMethod === "cash") cashBalance += amount;
      else digitalBalance += amount;
    } else {
      cashOut += amount;
      if (entry.paymentMethod === "cash") cashBalance -= amount;
      else digitalBalance -= amount;
    }
  }

  res.json({
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totalCashIn: Math.round(cashIn * 100) / 100,
    totalCashOut: Math.round(cashOut * 100) / 100,
    cashBalance: Math.round(cashBalance * 100) / 100,
    digitalBalance: Math.round(digitalBalance * 100) / 100,
    entries: entries.map(formatEntry),
  });
});

router.get("/reports/profit", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId!;
  const period = req.query.period as string;
  const date = req.query.date as string | undefined;

  if (!period || !["daily", "weekly", "monthly", "yesterday"].includes(period)) {
    res.status(400).json({ error: "Invalid period. Use daily, weekly, monthly, or yesterday" });
    return;
  }

  const { start, end } = getDateRange(period, date);

  const entries = await db
    .select()
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.userId, userId),
        isNull(entriesTable.deletedAt),
        gte(entriesTable.entryDate, start),
        lte(entriesTable.entryDate, end)
      )
    )
    .orderBy(entriesTable.entryDate);

  let totalProfit = 0;
  const entriesWithProfit = entries.filter((e) => e.profit != null);

  for (const entry of entriesWithProfit) {
    if (entry.profit) totalProfit += parseFloat(entry.profit);
  }

  res.json({
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totalProfit: Math.round(totalProfit * 100) / 100,
    entriesWithProfit: entries.map(formatEntry),
  });
});

export default router;
