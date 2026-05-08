import { useEffect, useState } from "react";
import {
  useGetEntriesReport,
  useGetProfitReport,
  useGetReportSummary,
  useGetMe,
  useListEntries,
  getGetEntriesReportQueryKey,
  getGetProfitReportQueryKey,
  getGetReportSummaryQueryKey,
  getListEntriesQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wallet,
  CreditCard,
  Download,
  CalendarDays,
  Calendar,
  Search,
  BarChart2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, getDaysInMonth, startOfMonth } from "date-fns";
import ReceiptModal, { type ReceiptData } from "@/components/receipt-modal";
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
  const [reportTab, setReportTab] = useState<"report" | "date" | "monthly-profit">("report");
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const { data: me } = useGetMe();

  useEffect(() => {
    document.title = "Reports - LedgerEntries";
  }, []);

  const { data: report, isLoading } = useGetEntriesReport(
    { period },
    { query: { queryKey: getGetEntriesReportQueryKey({ period }), refetchInterval: 30000 } }
  );

  const { data: profitReport, isLoading: profitLoading } = useGetProfitReport(
    { period },
    { query: { queryKey: getGetProfitReportQueryKey({ period }), refetchInterval: 30000 } }
  );

  const { data: monthlyProfitReport, isLoading: monthlyProfitLoading } = useGetProfitReport(
    { period: "monthly" },
    { query: { queryKey: [...getGetProfitReportQueryKey({ period: "monthly" }), "monthly-tab"], refetchInterval: 30000 } }
  );

  const { data: summary } = useGetReportSummary({
    query: { queryKey: getGetReportSummaryQueryKey(), refetchInterval: 30000 },
  } as any);

  const { data: dateEntries, isLoading: dateLoading } = useListEntries(
    { date: selectedDate },
    {
      query: {
        queryKey: [...getListEntriesQueryKey({ date: selectedDate }), "date-tab"],
        enabled: !!selectedDate,
      },
    }
  );

  const currentMonthName = format(new Date(), "MMMM yyyy");

  // Build day-wise profit chart data for current month
  const chartData = (() => {
    const now = new Date();
    const daysInMonth = getDaysInMonth(now);
    const profitByDay: Record<number, number> = {};

    (monthlyProfitReport?.entriesWithProfit ?? [])
      .filter((e) => e.profit != null)
      .forEach((e) => {
        const d = new Date(e.entryDate).getDate();
        profitByDay[d] = (profitByDay[d] ?? 0) + (e.profit ?? 0);
      });

    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      label: `${i + 1}`,
      profit: profitByDay[i + 1] ?? 0,
    })).filter((d) => d.profit > 0 || d.day <= new Date().getDate());
  })();

  const maxProfit = Math.max(...chartData.map((d) => d.profit), 1);

  // Date tab summary
  const dateTotal = {
    cashIn: (dateEntries ?? []).filter((e) => e.type === "cash_in").reduce((s, e) => s + e.amount, 0),
    cashOut: (dateEntries ?? []).filter((e) => e.type === "cash_out").reduce((s, e) => s + e.amount, 0),
    profit: (dateEntries ?? []).reduce((s, e) => s + (e.profit ?? 0), 0),
    count: (dateEntries ?? []).length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground">Financial summary with profit breakdown</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={reportTab} onValueChange={(v) => setReportTab(v as typeof reportTab)}>
          <TabsList className="w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="report" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              Report
            </TabsTrigger>
            <TabsTrigger value="date" className="text-xs">
              <Search className="h-3 w-3 mr-1" />
              Date
            </TabsTrigger>
            <TabsTrigger value="monthly-profit" className="text-xs">
              <BarChart2 className="h-3 w-3 mr-1" />
              Profit
            </TabsTrigger>
          </TabsList>

          {/* ── Main Report Tab ── */}
          <TabsContent value="report" className="mt-0">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList className="w-full mb-4 grid grid-cols-2">
                <TabsTrigger value="monthly" data-testid="tab-monthly-report">
                  <CalendarDays className="h-3.5 w-3.5 mr-1" />
                  Monthly
                </TabsTrigger>
                <TabsTrigger value="yearly" data-testid="tab-yearly-report">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Yearly
                </TabsTrigger>
              </TabsList>

              <TabsContent value={period} className="mt-0">
                {isLoading || profitLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : report ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      {`${format(new Date(report.startDate), "MMM d, yyyy")} — ${format(new Date(report.endDate), "MMM d, yyyy")}`}
                    </p>

                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cash Summary</p>
                      <p className="text-[10px] text-muted-foreground">(this period only)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                        <p className="text-xs text-green-600 font-medium">Total In</p>
                        <p className="text-lg font-bold text-green-700" data-testid="report-cash-in">
                          {formatCurrency(report.totalCashIn)}
                        </p>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                        <p className="text-xs text-red-600 font-medium">Total Out</p>
                        <p className="text-lg font-bold text-red-700" data-testid="report-cash-out">
                          {formatCurrency(report.totalCashOut)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Balances</p>
                      <p className="text-[10px] text-muted-foreground">(all-time)</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-card border rounded-xl p-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Cash</p>
                          <p className={`text-lg font-bold ${(summary as any)?.cashBalance >= 0 ? "text-foreground" : "text-red-600"}`} data-testid="report-cash-balance">
                            {formatCurrency((summary as any)?.cashBalance ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-card border rounded-xl p-3 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Digital</p>
                          <p className={`text-lg font-bold ${(summary as any)?.digitalBalance >= 0 ? "text-foreground" : "text-red-600"}`} data-testid="report-digital-balance">
                            {formatCurrency((summary as any)?.digitalBalance ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Profit Report</p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                        <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Sparkles className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs text-amber-600 font-medium">Total Profit</p>
                          <p className="text-2xl font-bold text-amber-700" data-testid="report-total-profit">
                            {formatCurrency(profitReport?.totalProfit ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-card border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground font-medium">Entries w/ Profit</p>
                        <p className="text-lg font-bold text-primary" data-testid="report-profit-entries-count">
                          {profitReport?.entriesWithProfit?.filter((e) => e.profit != null).length ?? 0}
                        </p>
                      </div>
                      <div className="bg-card border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground font-medium">Total Entries</p>
                        <p className="text-lg font-bold" data-testid="report-entry-count">
                          {report.entries.length}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Entries</p>
                    <div className="space-y-2">
                      {report.entries.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <p className="font-medium">No entries for this period</p>
                        </div>
                      ) : (
                        report.entries.map((entry) => (
                          <div key={entry.id} className="bg-card border rounded-xl p-3 flex items-center gap-3" data-testid={`report-entry-${entry.id}`}>
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${entry.type === "cash_in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                              {entry.type === "cash_in" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(entry.entryDate), "MMM d, h:mm a")}
                                </p>
                                {entry.paymentMethod === "digital" && (
                                  <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0">Digital</Badge>
                                )}
                                {entry.profit != null && (
                                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                    Profit: {formatCurrency(entry.profit)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className={`text-sm font-bold ${entry.type === "cash_in" ? "text-green-600" : "text-red-600"}`}>
                                {entry.type === "cash_in" ? "+" : "-"}{formatCurrency(entry.amount)}
                              </p>
                              {entry.paymentMethod === "digital" && !entry.isCredit && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 gap-1 flex-shrink-0"
                                  onClick={() => {
                                    setReceiptData({
                                      storeName: (me as any)?.storeName || (me as any)?.username || "My Store",
                                      transactionType: entry.type === "cash_out" ? "Fund Transfer" : "Fund Receive",
                                      amount: entry.amount,
                                      customerName: (entry as any).customerName || null,
                                      contactNumber: (entry as any).contactNumber || null,
                                      description: entry.description || null,
                                      date: new Date(entry.entryDate),
                                    });
                                    setReceiptOpen(true);
                                  }}
                                >
                                  <Download className="h-3 w-3" />
                                  Receipt
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <p>No data available</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Date Search Tab ── */}
          <TabsContent value="date" className="mt-0">
            {/* Date picker */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                Select Date
              </label>
              <Input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11 text-sm font-medium"
              />
            </div>

            {selectedDate && (
              <p className="text-sm font-semibold text-foreground mb-3">
                {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
              </p>
            )}

            {dateLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Day summary cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                    <p className="text-xs text-green-600 font-medium">Cash In</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(dateTotal.cashIn)}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-600 font-medium">Cash Out</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(dateTotal.cashOut)}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-xs text-amber-600 font-medium">Profit</p>
                    <p className="text-lg font-bold text-amber-700">{formatCurrency(dateTotal.profit)}</p>
                  </div>
                  <div className="bg-card border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-medium">Total Entries</p>
                    <p className="text-lg font-bold text-foreground">{dateTotal.count}</p>
                  </div>
                </div>

                {/* Entry list */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Entries
                </p>
                {(dateEntries ?? []).length === 0 ? (
                  <div className="text-center py-14 text-muted-foreground">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No entries on this date</p>
                    <p className="text-xs mt-1">Try a different date</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(dateEntries ?? []).map((entry) => (
                      <div key={entry.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${entry.type === "cash_in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                          {entry.type === "cash_in" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.entryDate), "h:mm a")}
                            </p>
                            {entry.paymentMethod === "digital" && (
                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0">Digital</Badge>
                            )}
                            {entry.isCredit && (
                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0">Credit</Badge>
                            )}
                            {entry.profit != null && (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                Profit: {formatCurrency(entry.profit)}
                              </span>
                            )}
                          </div>
                          {(entry as any).customerName && (
                            <p className="text-xs text-muted-foreground">{(entry as any).customerName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <p className={`text-sm font-bold ${entry.type === "cash_in" ? "text-green-600" : "text-red-600"}`}>
                            {entry.type === "cash_in" ? "+" : "-"}{formatCurrency(entry.amount)}
                          </p>
                          {entry.paymentMethod === "digital" && !entry.isCredit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 gap-1"
                              onClick={() => {
                                setReceiptData({
                                  storeName: (me as any)?.storeName || (me as any)?.username || "My Store",
                                  transactionType: entry.type === "cash_out" ? "Fund Transfer" : "Fund Receive",
                                  amount: entry.amount,
                                  customerName: (entry as any).customerName || null,
                                  contactNumber: (entry as any).contactNumber || null,
                                  description: entry.description || null,
                                  date: new Date(entry.entryDate),
                                });
                                setReceiptOpen(true);
                              }}
                            >
                              <Download className="h-3 w-3" />
                              Receipt
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Monthly Profit Tab ── */}
          <TabsContent value="monthly-profit" className="mt-0">
            {/* Summary header */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 mb-4">
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Monthly Profit Report</p>
                <p className="text-xs text-amber-700 mt-0.5">{currentMonthName}</p>
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

            {/* ── Bar Chart — Day-wise profit ── */}
            {!monthlyProfitLoading && chartData.some((d) => d.profit > 0) && (
              <div className="bg-card border rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Day-wise Profit — {currentMonthName}
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      interval={chartData.length > 15 ? 2 : 0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatShort}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Profit"]}
                      labelFormatter={(label) => `Day ${label}`}
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
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Peak day callout */}
                {(() => {
                  const peak = chartData.reduce((a, b) => (b.profit > a.profit ? b : a), chartData[0]);
                  if (!peak || peak.profit === 0) return null;
                  return (
                    <div className="mt-2 flex items-center justify-between bg-amber-50 rounded-lg px-3 py-1.5">
                      <p className="text-[11px] text-amber-700 font-medium">Best Day: {format(new Date(new Date().getFullYear(), new Date().getMonth(), peak.day), "MMMM d")}</p>
                      <p className="text-[11px] font-bold text-amber-700">{formatCurrency(peak.profit)}</p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Entry list */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Profit Entries — {currentMonthName}
            </p>
            {monthlyProfitLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (monthlyProfitReport?.entriesWithProfit?.filter((e) => e.profit != null).length ?? 0) === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No profit entries this month</p>
                <p className="text-xs mt-1">Add profit when recording Cash In entries</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(monthlyProfitReport?.entriesWithProfit ?? [])
                  .filter((e) => e.profit != null)
                  .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
                  .map((entry) => (
                    <div key={entry.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.description || "Cash In"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(entry.entryDate), "MMM d, yyyy · h:mm a")}
                        </p>
                        <p className="text-xs text-green-600 mt-0.5">
                          Sale: {formatCurrency(entry.amount)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-amber-500 font-semibold uppercase">Profit</p>
                        <p className="text-base font-bold text-amber-700">{formatCurrency(entry.profit ?? 0)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receiptData}
      />
    </div>
  );
}
