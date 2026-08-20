import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfitReport,
  useUpdateEntryProfit,
  getGetProfitReportQueryKey,
} from "@workspace/api-client-react";
import { useListProductReturns, useListProductSales } from "@/lib/inventory-api";
import { TrendingUp, TrendingDown, Loader2, Save, ArrowDownCircle, CalendarDays, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(amount);
}

type Entry = {
  id: number;
  type: string;
  amount: number;
  description?: string | null;
  profit?: number | null;
  isCredit?: boolean;
  customerName?: string | null;
  source?: string | null;
  entryDate: string;
};

function isCreditPayment(entry: Entry) {
  return (
    entry.description?.toLowerCase().includes("credit payment received from") ||
    entry.description?.toLowerCase().includes("payment received from")
  );
}

function isProductSaleEntry(entry: Entry) {
  return (
    (entry.source === "product_sale" || entry.source === "mobile_sale") &&
    !(entry.description ?? "").toLowerCase().startsWith("product return")
  );
}

function ProfitEntryRow({
  entry,
  index,
  onSave,
}: {
  entry: Entry;
  index: number;
  onSave: (id: number, profit: number | null) => void;
}) {
  const [profit, setProfit] = useState<string>(entry.profit != null ? String(entry.profit) : "");
  const [changed, setChanged] = useState(false);

  const handleChange = (val: string) => {
    setProfit(val);
    setChanged(true);
  };

  const handleSave = () => {
    if (!changed) return;
    const val = profit === "" ? null : parseFloat(profit);
    onSave(entry.id, val);
    setChanged(false);
  };

  const creditPayment = isCreditPayment(entry);

  return (
    <tr
      className={`border-b last:border-b-0 hover:bg-muted/20 ${creditPayment ? "bg-green-50/30" : ""}`}
      data-testid={`profit-entry-${entry.id}`}
    >
      <td className="text-center py-2 px-2 text-xs text-muted-foreground">{index + 1}</td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex h-6 w-6 rounded-full items-center justify-center flex-shrink-0 ${
              creditPayment
                ? "bg-green-100 text-green-600"
                : entry.type === "cash_in"
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            {creditPayment ? (
              <ArrowDownCircle className="h-3.5 w-3.5" />
            ) : entry.type === "cash_in" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="font-medium">
            {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
          </span>
          {creditPayment && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-0 flex-shrink-0">
              Credit Payment
            </Badge>
          )}
          {isProductSaleEntry(entry) && !creditPayment && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-0 flex-shrink-0">
              Product Sale
            </Badge>
          )}
          {entry.isCredit && !creditPayment && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0 flex-shrink-0">
              Credit Given
            </Badge>
          )}
        </div>
      </td>
      <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(entry.entryDate), "MMM d, h:mm a")}
      </td>
      <td
        className={`text-right py-2 px-2 text-xs font-semibold whitespace-nowrap ${
          entry.type === "cash_in" ? "text-green-600" : "text-red-600"
        }`}
      >
        {entry.type === "cash_in" ? "+" : "-"}
        {formatCurrency(entry.amount)}
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-2 justify-end">
          <div className="w-28">
            <Input
              type="number"
              placeholder="Profit"
              value={profit}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="h-8 text-sm"
              data-testid={`profit-input-${entry.id}`}
            />
          </div>
          {changed && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={handleSave}
              data-testid={`save-profit-${entry.id}`}
            >
              <Save className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function Profits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"daily" | "yesterday">("daily");

  useEffect(() => { document.title = "Profit Tracker - LedgerEntries"; }, []);

  const { data: report, isLoading } = useGetProfitReport(
    { period },
    { query: { queryKey: getGetProfitReportQueryKey({ period }) } }
  );
  const salesDate = new Date();
  if (period === "yesterday") salesDate.setDate(salesDate.getDate() - 1);
  const { data: productSales = [] } = useListProductSales({
    dateFrom: format(salesDate, "yyyy-MM-dd"),
    dateTo: format(salesDate, "yyyy-MM-dd"),
  });
  const { data: allReturns = [] } = useListProductReturns();

  const updateProfit = useUpdateEntryProfit();

  const handleSaveProfit = (id: number, profit: number | null) => {
    updateProfit.mutate(
      { id, data: { profit } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfitReportQueryKey({ period }) });
          toast({ title: "Profit updated" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.error || "Failed to update profit.", variant: "destructive" });
        },
      }
    );
  };

  const rawEntries = (report?.entriesWithProfit ?? []).filter((e) => !isCreditPayment(e));
  const returnEntry = (e: Entry) => (e.description ?? "").toLowerCase().startsWith("product return");
  const saleEntries = rawEntries.filter(isProductSaleEntry);
  const returnEntries = rawEntries.filter(returnEntry);
  const allEntries = rawEntries.filter(e => !isProductSaleEntry(e) && !returnEntry(e));
  const profitEntries = allEntries.filter((e) => e.profit != null);
  const totalProfit = report?.totalProfit ?? 0;

  // Product profit = sum of profit on sale-generated entries (source-tagged).
  // Entry profit is authoritative — manual profit edits on sale entries count here too.
  // Fallback to the "Mobile Sale:" description prefix for old rows without a source.
  const isSaleEntry = (e: Entry) =>
    isProductSaleEntry(e) ||
    (e.source == null && (e.description ?? "").startsWith("Mobile Sale:"));
  const productProfit =
    Math.round(
      saleEntries
        .filter((e) => e.profit != null && isSaleEntry(e))
        .reduce((sum, e) => sum + (e.profit ?? 0), 0) * 100
    ) / 100;
  const returnProfit = Math.round(returnEntries.reduce((sum, e) => sum + (e.profit ?? 0), 0) * 100) / 100;
  const otherProfit = Math.round((totalProfit - productProfit - returnProfit) * 100) / 100;
  const periodReturns = allReturns
    .filter(item => format(new Date(item.returnDate), "yyyy-MM-dd") === format(salesDate, "yyyy-MM-dd"))
    .sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime());

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Profit Tracker</h1>
        <p className="text-xs text-muted-foreground">Record profit per entry</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="w-full mb-4 grid grid-cols-2">
            <TabsTrigger value="daily" data-testid="tab-today-profit">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Today
            </TabsTrigger>
            <TabsTrigger value="yesterday" data-testid="tab-yesterday-profit">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Yesterday
            </TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="mt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <>
                {/* Total Profit Card */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Total Profit */}
                    <div>
                      <p className="text-sm text-primary font-medium">
                        Total Profit — {period === "daily" ? "Today" : "Yesterday"}
                      </p>
                      <p className="text-3xl font-bold text-primary mt-1" data-testid="total-profit-display">
                        {formatCurrency(totalProfit)}
                      </p>
                    </div>
                    {/* Right: Product Profit (from sales) */}
                    <div className="text-right">
                      <p className="text-sm text-emerald-700 font-medium">
                        Product Profit (from sales)
                      </p>
                      <p className="text-3xl font-bold text-emerald-700 mt-1" data-testid="product-profit-display">
                        {formatCurrency(productProfit)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1" data-testid="other-profit-display">
                        Manual/Other: {formatCurrency(otherProfit)}
                      </p>
                    </div>
                  </div>
                  {report && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(report.startDate), "MMM d, yyyy")}
                      {" · "}
                      {profitEntries.length} entries with profit set
                    </p>
                  )}
                </div>

                {/* All entries - set profit on any entry */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {allEntries.length} entries — enter profit below
                  </p>
                </div>
                {allEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="font-medium">
                      {period === "daily" ? "No entries today" : "No entries yesterday"}
                    </p>
                    <p className="text-sm">Add entries from the home screen</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-teal-50 dark:bg-teal-950/20">
                          <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
                          <th className="text-left py-2 px-2 border-b text-xs">Description</th>
                          <th className="text-left py-2 px-2 border-b text-xs">Date</th>
                          <th className="text-right py-2 px-2 border-b text-xs">Amount</th>
                          <th className="text-right py-2 px-2 border-b text-xs">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allEntries
                          .slice()
                          .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
                          .map((entry, idx) => (
                            <ProfitEntryRow
                              key={entry.id}
                              entry={entry}
                              index={idx}
                              onSave={handleSaveProfit}
                            />
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {productSales.length > 0 && (
                  <div className="border rounded-xl mt-5 overflow-hidden">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Product Sale History — {period === "daily" ? "Today" : "Yesterday"}
                      </p>
                    </div>
                    <div className="divide-y">
                      {[...productSales].sort((a, b) => {
                        const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
                        return dateDiff !== 0 ? dateDiff : b.id - a.id;
                      }).map(sale => (
                        <div key={sale.id} className="px-3 py-2 flex items-center gap-3">
                          <Badge className="text-[10px] py-0 px-1.5 h-4 bg-emerald-100 text-emerald-700 border-0">Sale #{sale.id}</Badge>
                          <p className="flex-1 min-w-0 text-xs truncate">
                            {(sale.items ?? []).map(item => `${item.productName || "Product"} × ${item.quantity}`).join(", ")}
                          </p>
                          <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">{formatCurrency(sale.totalAmount)}</span>
                          <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Profit {formatCurrency(sale.totalProfit)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {periodReturns.length > 0 && (
                  <div className="border rounded-xl mt-4 overflow-hidden">
                    <div className="bg-orange-50 dark:bg-orange-950/20 px-3 py-2">
                      <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                        Product Return History — {period === "daily" ? "Today" : "Yesterday"}
                      </p>
                    </div>
                    <div className="divide-y">
                      {periodReturns.map(item => (
                        <div key={item.id} className="px-3 py-2 flex items-center gap-3">
                          <Badge className="text-[10px] py-0 px-1.5 h-4 bg-orange-100 text-orange-700 border-0">Return</Badge>
                          <p className="flex-1 min-w-0 text-xs truncate">{item.productName || "Product"} × {item.quantity}</p>
                          <span className="text-xs font-semibold text-red-600 whitespace-nowrap">-{formatCurrency(item.returnAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
