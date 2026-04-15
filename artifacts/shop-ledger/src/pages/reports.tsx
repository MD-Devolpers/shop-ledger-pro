import { useEffect, useState } from "react";
import {
  useGetEntriesReport,
  getGetEntriesReportQueryKey,
} from "@workspace/api-client-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(amount);
}

export default function Reports() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => { document.title = "Reports - Daily Shop Ledger"; }, []);

  const { data: report, isLoading } = useGetEntriesReport(
    { period },
    { query: { queryKey: getGetEntriesReportQueryKey({ period }) } }
  );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-xs text-muted-foreground">Financial summary and entry reports</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="daily" data-testid="tab-daily-report">Daily</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly-report">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly-report">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="mt-0">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />)}
              </div>
            ) : report ? (
              <>
                {/* Period Info */}
                <p className="text-xs text-muted-foreground mb-3">
                  {format(new Date(report.startDate), "MMM d, yyyy")} — {format(new Date(report.endDate), "MMM d, yyyy")}
                </p>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                    <p className="text-xs text-green-600 font-medium">Total In</p>
                    <p className="text-lg font-bold text-green-700" data-testid="report-cash-in">{formatCurrency(report.totalCashIn)}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-600 font-medium">Total Out</p>
                    <p className="text-lg font-bold text-red-700" data-testid="report-cash-out">{formatCurrency(report.totalCashOut)}</p>
                  </div>
                  <div className="bg-card border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-medium">Cash Balance</p>
                    <p className={`text-lg font-bold ${report.cashBalance >= 0 ? "text-foreground" : "text-red-600"}`} data-testid="report-cash-balance">
                      {formatCurrency(report.cashBalance)}
                    </p>
                  </div>
                  <div className="bg-card border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-medium">Digital Balance</p>
                    <p className={`text-lg font-bold ${report.digitalBalance >= 0 ? "text-foreground" : "text-red-600"}`} data-testid="report-digital-balance">
                      {formatCurrency(report.digitalBalance)}
                    </p>
                  </div>
                </div>

                {/* Entry Count */}
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium">Total Entries</p>
                  <p className="text-xl font-bold text-primary" data-testid="report-entry-count">{report.entries.length}</p>
                </div>

                {/* Entries List */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Entries</p>
                <div className="space-y-2">
                  {report.entries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="font-medium">No entries for this period</p>
                    </div>
                  ) : (
                    report.entries.map((entry) => (
                      <div key={entry.id} className="bg-card border rounded-xl p-3 flex items-center gap-3" data-testid={`report-entry-${entry.id}`}>
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.type === "cash_in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                          }`}
                        >
                          {entry.type === "cash_in" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs text-muted-foreground">{format(new Date(entry.entryDate), "MMM d, h:mm a")}</p>
                            {entry.paymentMethod === "digital" && (
                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0">Digital</Badge>
                            )}
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${entry.type === "cash_in" ? "text-green-600" : "text-red-600"}`}>
                          {entry.type === "cash_in" ? "+" : "-"}{formatCurrency(entry.amount)}
                        </p>
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
    </div>
  );
}
