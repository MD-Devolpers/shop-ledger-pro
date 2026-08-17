import { useEffect, useState, useMemo } from "react";
import {
  useGetProfitReport,
  useListEntries,
  getGetProfitReportQueryKey,
  getListEntriesQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart2,
  TableIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getDaysInMonth, subDays, getWeek, startOfYear, startOfMonth, subMonths, addMonths, isSameMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatShort(amount: number) {
  if (amount >= 100000) return `${(amount / 1000).toFixed(0)}k`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return String(amount);
}

export default function Reports() {
  const [reportTab, setReportTab] = useState<"monthly-profit" | "table">("table");
  // Table tab state
  const [tableMode, setTableMode] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [tableDate, setTableDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [tableWeekRef, setTableWeekRef] = useState(() => new Date());
  const [tableMonthRef, setTableMonthRef] = useState(() => new Date());
  const [tableCustomStart, setTableCustomStart] = useState(() => new Date().toISOString().split("T")[0]);
  const [tableCustomEnd, setTableCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [graphFilter, setGraphFilter] = useState<"7days" | "weekly" | "monthly" | "yearly">("7days");
  const [selectedProfitMonth, setSelectedProfitMonth] = useState<Date>(() => startOfMonth(new Date()));
  useEffect(() => {
    document.title = "Reports - LedgerEntries";
  }, []);

  const profitMonthDateStr = format(selectedProfitMonth, "yyyy-MM-dd");
  const isCurrentMonth = isSameMonth(selectedProfitMonth, new Date());
  const minProfitMonth = startOfMonth(subMonths(new Date(), 11));

  const { data: monthlyProfitReport, isLoading: monthlyProfitLoading } = useGetProfitReport(
    { period: "monthly", date: profitMonthDateStr },
    { query: { queryKey: [...getGetProfitReportQueryKey({ period: "monthly", date: profitMonthDateStr }), "monthly-tab"], refetchInterval: 30000 } }
  );

  const { data: yearlyProfitReport } = useGetProfitReport(
    { period: "yearly" },
    { query: { queryKey: [...getGetProfitReportQueryKey({ period: "yearly" }), "yearly-chart"], refetchInterval: 60000 } }
  );

  // Table tab — compute API params
  const tableQueryParams = useMemo(() => {
    if (tableMode === "daily") return { date: tableDate };
    if (tableMode === "weekly") {
      return {
        start_date: format(startOfWeek(tableWeekRef, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end_date: format(endOfWeek(tableWeekRef, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    if (tableMode === "monthly") {
      return {
        start_date: format(startOfMonth(tableMonthRef), "yyyy-MM-dd"),
        end_date: format(endOfMonth(tableMonthRef), "yyyy-MM-dd"),
      };
    }
    return { start_date: tableCustomStart, end_date: tableCustomEnd };
  }, [tableMode, tableDate, tableWeekRef, tableMonthRef, tableCustomStart, tableCustomEnd]);

  const { data: tableEntries = [], isLoading: tableLoading } = useListEntries(
    tableQueryParams as any,
    { query: { queryKey: [...getListEntriesQueryKey(tableQueryParams as any), "table-tab"], enabled: reportTab === "table" } }
  );

  const tableSummary = useMemo(() => {
    const totalIn = tableEntries.filter((e) => e.type === "cash_in").reduce((s, e) => s + e.amount, 0);
    const totalOut = tableEntries.filter((e) => e.type === "cash_out").reduce((s, e) => s + e.amount, 0);
    const cashIn = tableEntries.filter((e) => e.type === "cash_in" && e.paymentMethod === "cash").reduce((s, e) => s + e.amount, 0);
    const digitalIn = tableEntries.filter((e) => e.type === "cash_in" && e.paymentMethod === "digital").reduce((s, e) => s + e.amount, 0);
    const totalProfit = tableEntries.reduce((s, e) => s + (e.profit ?? 0), 0);
    return { totalIn, totalOut, net: totalIn - totalOut, cashIn, digitalIn, totalProfit, count: tableEntries.length };
  }, [tableEntries]);

  const tableSorted = useMemo(
    () => [...tableEntries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()),
    [tableEntries]
  );

  const tablePeriodLabel = useMemo(() => {
    if (tableMode === "daily") return format(new Date(tableDate + "T00:00:00"), "EEEE, MMMM d, yyyy");
    if (tableMode === "weekly") {
      const ws = startOfWeek(tableWeekRef, { weekStartsOn: 1 });
      const we = endOfWeek(tableWeekRef, { weekStartsOn: 1 });
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    if (tableMode === "monthly") return format(tableMonthRef, "MMMM yyyy");
    return `${tableCustomStart} to ${tableCustomEnd}`;
  }, [tableMode, tableDate, tableWeekRef, tableMonthRef, tableCustomStart, tableCustomEnd]);

  // ── Chart data based on selected filter ──
  const chartData = (() => {
    const now = new Date();
    const refMonth = selectedProfitMonth;

    if (graphFilter === "7days") {
      // Last 7 days of the selected month (or today if current month)
      const refEnd = isCurrentMonth ? now : endOfMonth(refMonth);
      const days = Array.from({ length: 7 }, (_, i) => subDays(refEnd, 6 - i));
      const profitByDate: Record<string, number> = {};
      (monthlyProfitReport?.entriesWithProfit ?? [])
        .filter((e) => e.profit != null)
        .forEach((e) => {
          const key = format(new Date(e.entryDate), "yyyy-MM-dd");
          profitByDate[key] = (profitByDate[key] ?? 0) + (e.profit ?? 0);
        });
      return days.map((d) => ({
        label: format(d, "EEE"),
        fullLabel: format(d, "EEE, MMM d"),
        profit: profitByDate[format(d, "yyyy-MM-dd")] ?? 0,
      }));
    }

    if (graphFilter === "weekly") {
      // Selected month split into weeks (Wk 1 … Wk 5)
      const daysInMonth = getDaysInMonth(refMonth);
      const profitByDay: Record<number, number> = {};
      (monthlyProfitReport?.entriesWithProfit ?? [])
        .filter((e) => e.profit != null)
        .forEach((e) => {
          const d = new Date(e.entryDate).getDate();
          profitByDay[d] = (profitByDay[d] ?? 0) + (e.profit ?? 0);
        });
      const weeks: { label: string; fullLabel: string; profit: number }[] = [];
      for (let start = 1; start <= daysInMonth; start += 7) {
        const end = Math.min(start + 6, daysInMonth);
        const wkNum = Math.ceil(start / 7);
        let total = 0;
        for (let d = start; d <= end; d++) total += profitByDay[d] ?? 0;
        weeks.push({
          label: `Wk ${wkNum}`,
          fullLabel: `Week ${wkNum} (${format(new Date(refMonth.getFullYear(), refMonth.getMonth(), start), "MMM d")} – ${format(new Date(refMonth.getFullYear(), refMonth.getMonth(), end), "MMM d")})`,
          profit: total,
        });
      }
      return weeks;
    }

    if (graphFilter === "yearly") {
      // Aggregate all profit entries by year → one bar per year
      const profitByYear: Record<number, number> = {};
      (yearlyProfitReport?.entriesWithProfit ?? [])
        .filter((e) => e.profit != null)
        .forEach((e) => {
          const y = new Date(e.entryDate).getFullYear();
          profitByYear[y] = (profitByYear[y] ?? 0) + (e.profit ?? 0);
        });
      const years = Object.keys(profitByYear).map(Number).sort((a, b) => a - b);
      if (years.length === 0) years.push(now.getFullYear());
      return years.map((y) => ({
        label: String(y),
        fullLabel: String(y),
        profit: profitByYear[y] ?? 0,
      }));
    }

    // Monthly: aggregate yearly data by month name
    const profitByMonth: Record<number, number> = {};
    (yearlyProfitReport?.entriesWithProfit ?? [])
      .filter((e) => e.profit != null)
      .forEach((e) => {
        const m = new Date(e.entryDate).getMonth(); // 0-11
        profitByMonth[m] = (profitByMonth[m] ?? 0) + (e.profit ?? 0);
      });
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return Array.from({ length: 12 }, (_, m) => ({
      label: monthNames[m],
      fullLabel: format(new Date(now.getFullYear(), m, 1), "MMMM yyyy"),
      profit: profitByMonth[m] ?? 0,
    }));
  })();

  // ── Period-driven breakdown list below the chart ──
  type BreakdownRow = { key: string; title: string; subtitle?: string; entries: number; profit: number };
  const breakdown: { heading: string; rows: BreakdownRow[]; emptyText: string } = (() => {
    const now = new Date();
    const refMonth = selectedProfitMonth;
    const monthEntries = (monthlyProfitReport?.entriesWithProfit ?? []).filter((e) => e.profit != null);
    const yearEntries = (yearlyProfitReport?.entriesWithProfit ?? []).filter((e) => e.profit != null);

    if (graphFilter === "7days") {
      // Last 7 days of the selected month (or ending today if current month)
      const refEnd = isCurrentMonth ? now : endOfMonth(refMonth);
      const days = Array.from({ length: 7 }, (_, i) => subDays(refEnd, 6 - i));
      const byDate: Record<string, { profit: number; entries: number }> = {};
      monthEntries.forEach((e) => {
        const key = format(new Date(e.entryDate), "yyyy-MM-dd");
        if (!byDate[key]) byDate[key] = { profit: 0, entries: 0 };
        byDate[key].profit += e.profit ?? 0;
        byDate[key].entries += 1;
      });
      const rows = days
        .slice()
        .reverse()
        .map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const v = byDate[key] ?? { profit: 0, entries: 0 };
          return {
            key,
            title: format(d, "EEEE"),
            subtitle: format(d, "MMMM d, yyyy"),
            entries: v.entries,
            profit: v.profit,
          };
        });
      return {
        heading: `Daily Profit — ${format(refMonth, "MMMM yyyy")}`,
        rows,
        emptyText: "No profit entries in the last 7 days",
      };
    }

    if (graphFilter === "weekly") {
      const daysInMonth = getDaysInMonth(refMonth);
      const byDay: Record<number, { profit: number; entries: number }> = {};
      monthEntries.forEach((e) => {
        const d = new Date(e.entryDate).getDate();
        if (!byDay[d]) byDay[d] = { profit: 0, entries: 0 };
        byDay[d].profit += e.profit ?? 0;
        byDay[d].entries += 1;
      });
      const rows: BreakdownRow[] = [];
      for (let start = 1; start <= daysInMonth; start += 7) {
        const end = Math.min(start + 6, daysInMonth);
        const wkNum = Math.ceil(start / 7);
        let profit = 0;
        let entries = 0;
        for (let d = start; d <= end; d++) {
          profit += byDay[d]?.profit ?? 0;
          entries += byDay[d]?.entries ?? 0;
        }
        rows.push({
          key: `wk-${wkNum}`,
          title: `Week ${wkNum}`,
          subtitle: `${format(new Date(refMonth.getFullYear(), refMonth.getMonth(), start), "MMM d")} – ${format(new Date(refMonth.getFullYear(), refMonth.getMonth(), end), "MMM d")}`,
          entries,
          profit,
        });
      }
      return {
        heading: `Weekly Profit — ${format(refMonth, "MMMM yyyy")}`,
        rows,
        emptyText: "No profit entries this month",
      };
    }

    if (graphFilter === "yearly") {
      const byYear: Record<number, { profit: number; entries: number }> = {};
      yearEntries.forEach((e) => {
        const y = new Date(e.entryDate).getFullYear();
        if (!byYear[y]) byYear[y] = { profit: 0, entries: 0 };
        byYear[y].profit += e.profit ?? 0;
        byYear[y].entries += 1;
      });
      let years = Object.keys(byYear).map(Number);
      if (years.length === 0) years = [now.getFullYear()];
      const rows = years
        .sort((a, b) => b - a)
        .map((y) => ({
          key: `yr-${y}`,
          title: String(y),
          subtitle: undefined,
          entries: byYear[y]?.entries ?? 0,
          profit: byYear[y]?.profit ?? 0,
        }));
      return {
        heading: "Yearly Profit",
        rows,
        emptyText: "No profit entries yet",
      };
    }

    // Monthly: one row per month (Jan..Dec) for the current year, showing months with data + current month
    const byMonth: Record<number, { profit: number; entries: number }> = {};
    yearEntries.forEach((e) => {
      const m = new Date(e.entryDate).getMonth();
      if (!byMonth[m]) byMonth[m] = { profit: 0, entries: 0 };
      byMonth[m].profit += e.profit ?? 0;
      byMonth[m].entries += 1;
    });
    const currentMonthIdx = now.getMonth();
    const rows = Array.from({ length: 12 }, (_, m) => m)
      .filter((m) => byMonth[m] != null || m === currentMonthIdx)
      .sort((a, b) => b - a)
      .map((m) => ({
        key: `mo-${m}`,
        title: format(new Date(now.getFullYear(), m, 1), "MMMM"),
        subtitle: String(now.getFullYear()),
        entries: byMonth[m]?.entries ?? 0,
        profit: byMonth[m]?.profit ?? 0,
      }));
    return {
      heading: `Monthly Profit — ${now.getFullYear()}`,
      rows,
      emptyText: "No profit entries this year",
    };
  })();

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground">Financial summary with profit breakdown</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={reportTab} onValueChange={(v) => setReportTab(v as typeof reportTab)}>
          <TabsList className="w-full mb-4 grid grid-cols-2">
            <TabsTrigger value="table" className="text-xs">
              <TableIcon className="h-3 w-3 mr-1" />
              Table
            </TabsTrigger>
            <TabsTrigger value="monthly-profit" className="text-xs">
              <BarChart2 className="h-3 w-3 mr-1" />
              Profit
            </TabsTrigger>
          </TabsList>

          {/* ── Monthly Profit Tab ── */}
          <TabsContent value="monthly-profit" className="mt-0">
            {/* Month Navigator */}
            <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2 mb-3">
              <button
                onClick={() => {
                  const prev = subMonths(selectedProfitMonth, 1);
                  if (prev >= minProfitMonth) setSelectedProfitMonth(prev);
                }}
                disabled={selectedProfitMonth <= minProfitMonth}
                className="h-8 w-8 flex items-center justify-center rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{format(selectedProfitMonth, "MMMM yyyy")}</p>
                {!isCurrentMonth && (
                  <button
                    onClick={() => setSelectedProfitMonth(startOfMonth(new Date()))}
                    className="text-[10px] text-amber-600 underline underline-offset-2 hover:text-amber-700"
                  >
                    Back to current month
                  </button>
                )}
              </div>
              <button
                onClick={() => { if (!isCurrentMonth) setSelectedProfitMonth(addMonths(selectedProfitMonth, 1)); }}
                disabled={isCurrentMonth}
                className="h-8 w-8 flex items-center justify-center rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>

            {/* Summary header */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 mb-4">
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Monthly Profit Report</p>
                <p className="text-xs text-amber-700 mt-0.5">{format(selectedProfitMonth, "MMMM yyyy")}</p>
                {monthlyProfitLoading ? (
                  <div className="h-7 w-28 bg-amber-200/50 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-amber-700 mt-0.5">
                    {formatCurrency(monthlyProfitReport?.totalProfit ?? 0)}
                  </p>
                )}
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-card border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Entries w/ Profit</p>
                <p className="text-xl font-bold text-primary">
                  {monthlyProfitReport?.entriesWithProfit?.filter((e) => e.profit != null).length ?? 0}
                </p>
              </div>
              <div className="bg-card border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg Per Entry</p>
                <p className="text-xl font-bold text-amber-600">
                  {(() => {
                    const entries = monthlyProfitReport?.entriesWithProfit?.filter((e) => e.profit != null) ?? [];
                    if (entries.length === 0) return formatCurrency(0);
                    const total = entries.reduce((s, e) => s + (e.profit ?? 0), 0);
                    return formatCurrency(Math.round(total / entries.length));
                  })()}
                </p>
              </div>
            </div>

            {/* ── Statistics Chart ── */}
            <div className="bg-card border rounded-xl p-3 mb-4">
              {/* Filter buttons */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Statistics
                </p>
                <div className="flex gap-1">
                  {(["7days", "weekly", "monthly", "yearly"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setGraphFilter(f)}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                        graphFilter === f
                          ? "bg-amber-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {f === "7days" ? "7 Days" : f === "weekly" ? "Weekly" : f === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>

              {monthlyProfitLoading ? (
                <div className="h-[180px] bg-muted/30 rounded-lg animate-pulse" />
              ) : chartData.every((d) => d.profit === 0) ? (
                <div className="h-[140px] flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">No profit data for this period</p>
                </div>
              ) : (
                <>
                  <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatShort}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), "Profit"]}
                        labelFormatter={(label) => {
                          const item = chartData.find((d) => d.label === label);
                          return item?.fullLabel ?? label;
                        }}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                      />
                      <Bar
                        dataKey="profit"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>

                  {/* Peak callout */}
                  {(() => {
                    const peak = [...chartData].sort((a, b) => b.profit - a.profit)[0];
                    if (!peak || peak.profit === 0) return null;
                    return (
                      <div className="mt-2 flex items-center justify-between bg-amber-50 rounded-lg px-3 py-1.5">
                        <p className="text-[11px] text-amber-700 font-medium">
                          Best: {peak.fullLabel}
                        </p>
                        <p className="text-[11px] font-bold text-amber-700">{formatCurrency(peak.profit)}</p>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* ── Period-driven profit breakdown ── */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {breakdown.heading}
            </p>
            {monthlyProfitLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-card border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : breakdown.rows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{breakdown.emptyText}</p>
                <p className="text-xs mt-1">Add profit when recording Cash In entries</p>
              </div>
            ) : (
              <div className="space-y-2">
                {breakdown.rows.map(({ key, title, subtitle, profit, entries }) => (
                  <div key={key} className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {title}
                      </p>
                      {subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {subtitle}
                        </p>
                      )}
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        {entries} {entries === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-amber-500 font-semibold uppercase">Profit</p>
                      <p className="text-base font-bold text-amber-700">{formatCurrency(profit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          {/* ── Table Tab ── */}
          <TabsContent value="table" className="mt-0 space-y-4">
            {/* Period label */}
            <p className="text-xs text-muted-foreground font-medium">{tablePeriodLabel}</p>

            {/* Mode selector */}
            <div className="grid grid-cols-4 gap-1 bg-muted rounded-xl p-1">
              {(["daily", "weekly", "monthly", "custom"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTableMode(m)}
                  className={`rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors ${
                    tableMode === m ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Date controls */}
            {tableMode === "daily" && (
              <Input
                type="date"
                value={tableDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setTableDate(e.target.value)}
                className="h-10 text-sm font-medium"
              />
            )}
            {tableMode === "weekly" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                  onClick={() => setTableWeekRef((d) => subWeeks(d, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-semibold">
                    {format(startOfWeek(tableWeekRef, { weekStartsOn: 1 }), "MMM d")} –{" "}
                    {format(endOfWeek(tableWeekRef, { weekStartsOn: 1 }), "MMM d, yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">Week {format(tableWeekRef, "w")} · {format(tableWeekRef, "yyyy")}</p>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                  disabled={endOfWeek(tableWeekRef, { weekStartsOn: 1 }) >= new Date()}
                  onClick={() => setTableWeekRef((d) => addWeeks(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {tableMode === "monthly" && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                  onClick={() => setTableMonthRef((d) => subMonths(d, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-semibold">{format(tableMonthRef, "MMMM yyyy")}</p>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0"
                  disabled={startOfMonth(tableMonthRef) >= startOfMonth(new Date())}
                  onClick={() => setTableMonthRef((d) => addMonths(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {tableMode === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">From</label>
                  <Input type="date" value={tableCustomStart} max={tableCustomEnd}
                    onChange={(e) => setTableCustomStart(e.target.value)} className="h-10 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">To</label>
                  <Input type="date" value={tableCustomEnd} max={new Date().toISOString().split("T")[0]} min={tableCustomStart}
                    onChange={(e) => setTableCustomEnd(e.target.value)} className="h-10 text-sm" />
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-xs text-green-700 font-medium">Total In</p>
                <p className="text-base font-bold text-green-700">{formatCurrency(tableSummary.totalIn)}</p>
                <p className="text-[10px] text-green-600 mt-0.5">Cash {formatCurrency(tableSummary.cashIn)} · Digital {formatCurrency(tableSummary.digitalIn)}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-xs text-red-700 font-medium">Total Out</p>
                <p className="text-base font-bold text-red-700">{formatCurrency(tableSummary.totalOut)}</p>
              </div>
              <div className={`border rounded-xl p-3 ${tableSummary.net >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
                <p className={`text-xs font-medium ${tableSummary.net >= 0 ? "text-blue-700" : "text-orange-700"}`}>Net</p>
                <p className={`text-base font-bold ${tableSummary.net >= 0 ? "text-blue-700" : "text-orange-700"}`}>{formatCurrency(tableSummary.net)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-700 font-medium">Profit</p>
                  <p className="text-base font-bold text-amber-700">{formatCurrency(tableSummary.totalProfit)}</p>
                </div>
                <div className="bg-card border rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-medium">Count</p>
                  <p className="text-base font-bold">{tableSummary.count}</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">All Entries</p>
              {tableLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-card border rounded-xl animate-pulse" />)}
                </div>
              ) : tableSorted.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <TableIcon className="h-10 w-10 mx-auto mb-3 opacity-25" />
                  <p className="font-medium">No entries for this period</p>
                  <p className="text-xs mt-1">Try a different date range</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden bg-card">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-muted/60 border-b text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Description / Date</span>
                    <span className="text-center">Method</span>
                    <span className="text-center">Type</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {/* Rows */}
                  <div className="divide-y">
                    {tableSorted.map((entry, idx) => (
                      <div key={entry.id}
                        className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-xs truncate leading-tight">
                            {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(entry.entryDate), tableMode === "daily" ? "h:mm a" : "MMM d, h:mm a")}
                            </span>
                            {entry.isCredit && (
                              <Badge className="text-[9px] px-1 py-0 h-3.5 bg-amber-100 text-amber-700 border-0 leading-none">Credit</Badge>
                            )}
                            {(entry as any).customerName && (
                              <span className="text-[10px] text-muted-foreground truncate">· {(entry as any).customerName}</span>
                            )}
                            {entry.profit != null && entry.profit > 0 && (
                              <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1 rounded-full">+{formatCurrency(entry.profit)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {entry.paymentMethod === "digital"
                            ? <Badge className="text-[9px] px-1.5 py-0 h-5 bg-blue-100 text-blue-700 border-0">Digital</Badge>
                            : <Badge className="text-[9px] px-1.5 py-0 h-5 bg-gray-100 text-gray-600 border-0">Cash</Badge>}
                        </div>
                        <div className="flex-shrink-0">
                          {entry.type === "cash_in"
                            ? <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center"><TrendingUp className="h-3 w-3 text-green-600" /></div>
                            : <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center"><TrendingDown className="h-3 w-3 text-red-600" /></div>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs font-bold ${entry.type === "cash_in" ? "text-green-600" : "text-red-600"}`}>
                            {entry.type === "cash_in" ? "+" : "-"}{formatCurrency(entry.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Footer */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2.5 bg-muted/40 border-t">
                    <div>
                      <p className="text-xs font-bold text-foreground">{tableSummary.count} entries</p>
                      <p className="text-[10px] text-muted-foreground">In: {formatCurrency(tableSummary.totalIn)} · Out: {formatCurrency(tableSummary.totalOut)}</p>
                    </div>
                    <div /><div />
                    <div className="text-right">
                      <p className={`text-xs font-bold ${tableSummary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {tableSummary.net >= 0 ? "+" : ""}{formatCurrency(tableSummary.net)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">net</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}
