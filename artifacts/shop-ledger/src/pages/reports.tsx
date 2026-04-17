import { useEffect, useState } from "react";
import {
  useGetEntriesReport,
  useGetProfitReport,
  useGetReportSummary,
  useGetMe,
  getGetEntriesReportQueryKey,
  getGetProfitReportQueryKey,
  getGetReportSummaryQueryKey,
} from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Sparkles, Wallet, CreditCard, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import ReceiptModal, { type ReceiptData } from "@/components/receipt-modal";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Reports() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
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

  const { data: summary } = useGetReportSummary({
    query: { queryKey: getGetReportSummaryQueryKey(), refetchInterval: 30000 },
  } as any);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground">Financial summary with profit breakdown</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="daily" data-testid="tab-daily-report">Daily</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly-report">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly-report">Monthly</TabsTrigger>
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
                {/* Period Info */}
                <p className="text-xs text-muted-foreground mb-3">
                  {period === "daily"
                    ? format(new Date(report.startDate), "MMM d, yyyy")
                    : `${format(new Date(report.startDate), "MMM d, yyyy")} — ${format(new Date(report.endDate), "MMM d, yyyy")}`}
                </p>

                {/* Period In/Out */}
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Cash Summary
                  </p>
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

                {/* All-time Balances from summary */}
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Current Balances
                  </p>
                  <p className="text-[10px] text-muted-foreground">(all-time running total)</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-card border rounded-xl p-3 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Cash Balance</p>
                      <p
                        className={`text-lg font-bold ${(summary as any)?.cashBalance >= 0 ? "text-foreground" : "text-red-600"}`}
                        data-testid="report-cash-balance"
                      >
                        {formatCurrency((summary as any)?.cashBalance ?? 0)}
                      </p>
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Digital Balance</p>
                      <p
                        className={`text-lg font-bold ${(summary as any)?.digitalBalance >= 0 ? "text-foreground" : "text-red-600"}`}
                        data-testid="report-digital-balance"
                      >
                        {formatCurrency((summary as any)?.digitalBalance ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profit Summary */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Profit Report
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-600 font-medium">Total Profit</p>
                      <p
                        className="text-2xl font-bold text-amber-700"
                        data-testid="report-total-profit"
                      >
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

                {/* Entries List with Profit */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Entries
                </p>
                <div className="space-y-2">
                  {report.entries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="font-medium">No entries for this period</p>
                    </div>
                  ) : (
                    report.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-card border rounded-xl p-3 flex items-center gap-3"
                        data-testid={`report-entry-${entry.id}`}
                      >
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.type === "cash_in"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {entry.type === "cash_in" ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.description ||
                              (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.entryDate), "MMM d, h:mm a")}
                            </p>
                            {entry.paymentMethod === "digital" && (
                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0">
                                Digital
                              </Badge>
                            )}
                            {entry.profit != null && (
                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                Profit: {formatCurrency(entry.profit)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <p
                            className={`text-sm font-bold ${
                              entry.type === "cash_in" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {entry.type === "cash_in" ? "+" : "-"}
                            {formatCurrency(entry.amount)}
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
      </div>

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receiptData}
      />
    </div>
  );
}
