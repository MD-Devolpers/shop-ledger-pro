import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEntries,
  useDeleteEntry,
  useRestoreEntry,
  getListEntriesQueryKey,
  getGetReportSummaryQueryKey,
} from "@workspace/api-client-react";
import { useListProductReturns, useListProductSales, type ProductSale } from "@/lib/inventory-api";
import {
  TrendingUp,
  TrendingDown,
  Trash2,
  Pencil,
  RotateCcw,
  Trash,
  CloudCheck,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EditEntryDialog from "@/components/edit-entry-dialog";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

type Entry = {
  id: number;
  type: string;
  amount: number;
  description?: string | null;
  paymentMethod: string;
  isCredit: boolean;
  customerName?: string | null;
  profit?: number | null;
  entryDate: string;
  deletedAt?: string | null;
  source?: string | null;
};

function EntryRow({
  entry,
  index,
  onEdit,
  onDelete,
  onRestore,
  isDeleted,
  sale,
}: {
  entry: Entry;
  index: number;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
  isDeleted?: boolean;
  sale?: ProductSale;
}) {
  return (
    <tr
      className={`border-b last:border-b-0 hover:bg-muted/20 ${isDeleted ? "opacity-70" : ""}`}
      data-testid={`entry-row-${entry.id}`}
    >
      <td className="text-center py-2 px-2 text-xs text-muted-foreground">{index + 1}</td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex h-6 w-6 rounded-full items-center justify-center flex-shrink-0 ${
              entry.type === "cash_in"
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            {entry.type === "cash_in" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="font-medium">
            {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
          </span>
          {sale && (
            <Badge className="text-[10px] py-0 px-1.5 h-4 bg-emerald-100 text-emerald-700 border-0">
              Sale #{sale.id}
            </Badge>
          )}
          {entry.paymentMethod === "digital" && (
            <Badge className="text-[10px] py-0 px-1.5 h-4 bg-blue-100 text-blue-700 border-0">
              Digital
            </Badge>
          )}
          {entry.isCredit && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
              Credit
            </Badge>
          )}
        </div>
        {entry.customerName && (
          <div className="text-xs text-muted-foreground mt-0.5">{entry.customerName}</div>
        )}
        {sale?.items && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {sale.items.map(item => `${item.productName || "Product"} × ${item.quantity}`).join(", ")}
          </div>
        )}
        {isDeleted && entry.deletedAt && (
          <div className="text-xs text-destructive font-medium mt-0.5">
            Deleted: {format(new Date(entry.deletedAt), "MMM d, yyyy")}
          </div>
        )}
      </td>
      <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(entry.entryDate), "MMM d, yyyy h:mm a")}
      </td>
      <td className="py-2 px-2 whitespace-nowrap">
        <span
          className={`text-xs font-medium ${
            entry.type === "cash_in" ? "text-green-600" : "text-red-600"
          }`}
        >
          {entry.type === "cash_in" ? "In" : "Out"}
        </span>
      </td>
      <td
        className={`text-right py-2 px-2 font-bold whitespace-nowrap ${
          entry.type === "cash_in" ? "text-green-600" : "text-red-600"
        }`}
      >
        {entry.type === "cash_in" ? "+" : "-"}
        {formatCurrency(entry.amount)}
      </td>
      <td className="text-right py-2 px-2 whitespace-nowrap">
        {entry.profit != null ? (
          <span className="text-amber-600 font-medium">{formatCurrency(entry.profit)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-right py-2 px-2 whitespace-nowrap">
        <div className="flex gap-1 justify-end">
          {isDeleted ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-primary border-primary/40 gap-1"
              onClick={() => onRestore?.(entry.id)}
              data-testid={`restore-${entry.id}`}
            >
              <RotateCcw className="h-3 w-3" />
              Restore
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit?.(entry.id)}
                data-testid={`edit-${entry.id}`}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => onDelete?.(entry.id)}
                data-testid={`delete-${entry.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function SaleHistoryTable({ sales, isLoading }: { sales: ProductSale[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No product sales found</p>
        <p className="text-xs mt-1">Product sale history will appear here after a sale is saved.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-teal-50 dark:bg-teal-950/20">
            <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
            <th className="text-left py-2 px-2 border-b text-xs">Sale</th>
            <th className="text-left py-2 px-2 border-b text-xs">Products / Qty</th>
            <th className="text-left py-2 px-2 border-b text-xs">Date</th>
            <th className="text-left py-2 px-2 border-b text-xs">Payment</th>
            <th className="text-right py-2 px-2 border-b text-xs">Total</th>
            <th className="text-right py-2 px-2 border-b text-xs">Profit</th>
          </tr>
        </thead>
        <tbody>
          {[...sales].sort((a, b) => {
            const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
            return dateDiff !== 0 ? dateDiff : b.id - a.id;
          }).map((sale, index) => (
            <tr key={sale.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="text-center py-2 px-2 text-xs text-muted-foreground">{index + 1}</td>
              <td className="py-2 px-2">
                <div className="font-medium">Sale #{sale.id}</div>
                {sale.customerName && <div className="text-xs text-muted-foreground">{sale.customerName}</div>}
                {sale.isCredit && <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 mt-1">Credit</Badge>}
              </td>
              <td className="py-2 px-2 min-w-[220px]">
                {(sale.items ?? []).map(item => (
                  <div key={item.id} className="text-xs">
                    {item.productName || item.productCode || "Product"} × {item.quantity}
                  </div>
                ))}
              </td>
              <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(sale.saleDate), "MMM d, yyyy h:mm a")}
              </td>
              <td className="py-2 px-2 text-xs capitalize">{sale.paymentMethod}</td>
              <td className="text-right py-2 px-2 font-bold text-green-600 whitespace-nowrap">
                {formatCurrency(sale.totalAmount)}
              </td>
              <td className="text-right py-2 px-2 text-amber-600 font-medium whitespace-nowrap">
                {formatCurrency(sale.totalProfit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReturnHistoryTable({ returns }: { returns: any[] }) {
  if (returns.length === 0) return null;
  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-orange-50 dark:bg-orange-950/20">
            <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
            <th className="text-left py-2 px-2 border-b text-xs">Product</th>
            <th className="text-left py-2 px-2 border-b text-xs">Date</th>
            <th className="text-left py-2 px-2 border-b text-xs">Payment</th>
            <th className="text-right py-2 px-2 border-b text-xs">Qty</th>
            <th className="text-right py-2 px-2 border-b text-xs">Refund</th>
          </tr>
        </thead>
        <tbody>
          {returns.map((item, index) => (
            <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
              <td className="text-center py-2 px-2 text-xs text-muted-foreground">{index + 1}</td>
              <td className="py-2 px-2">
                <div className="font-medium">{item.productName || "Product"}</div>
                {item.productCode && <div className="text-xs text-muted-foreground">{item.productCode}</div>}
              </td>
              <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(item.returnDate), "MMM d, yyyy h:mm a")}
              </td>
              <td className="py-2 px-2 text-xs capitalize">{item.paymentMethod}</td>
              <td className="text-right py-2 px-2">{item.quantity}</td>
              <td className="text-right py-2 px-2 font-bold text-red-600 whitespace-nowrap">
                -{formatCurrency(item.returnAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Entries() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [editEntry, setEditEntry] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Entries - LedgerEntries";
  }, []);

  const queryParams =
    tab === "bin"
      ? { deleted: true }
      : tab === "cash_in"
        ? { type: "cash_in" as const }
        : tab === "cash_out"
          ? { type: "cash_out" as const }
          : {};

  const { data: allEntries, isLoading } = useListEntries(queryParams);
  const { data: saleHistory = [], isLoading: isSaleHistoryLoading } = useListProductSales();
  const { data: returnHistory = [] } = useListProductReturns();

  const isSaleEntry = (entry: Entry) =>
    (entry.source === "product_sale" || entry.source === "mobile_sale") &&
    !(entry.description ?? "").toLowerCase().startsWith("product return");
  const isReturnEntry = (entry: Entry) =>
    (entry.description ?? "").toLowerCase().startsWith("product return");
  const visibleEntries = (allEntries ?? []).filter(entry => {
    if (tab === "all") return !isSaleEntry(entry) && !isReturnEntry(entry);
    if (tab === "cash_in" || tab === "cash_out") return !isSaleEntry(entry) && !isReturnEntry(entry);
    return true;
  });

  const deleteEntry = useDeleteEntry();
  const restoreEntry = useRestoreEntry();

  const handleDelete = (id: number) => {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
          toast({ title: "Moved to Recycle Bin", description: "You can restore it from the Bin tab." });
        },
      }
    );
  };

  const handleRestore = (id: number) => {
    restoreEntry.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
          toast({ title: "Entry restored successfully" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Entries</h1>
        <p className="text-xs text-muted-foreground">All your ledger entries</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Data saved banner */}
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3">
          <CloudCheck className="h-4 w-4 flex-shrink-0" />
          <span>Your data is saved on the server and stays safe even after logout.</span>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4 grid grid-cols-5">
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="cash_in" data-testid="tab-cash-in">
              In
            </TabsTrigger>
            <TabsTrigger value="cash_out" data-testid="tab-cash-out">
              Out
            </TabsTrigger>
            <TabsTrigger
              value="bin"
              data-testid="tab-bin"
              className="flex items-center gap-1 data-[state=active]:text-destructive"
            >
              <Trash className="h-3.5 w-3.5" />
              Bin
            </TabsTrigger>
            <TabsTrigger value="sale_history" data-testid="tab-sale-history" className="flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              Sales
            </TabsTrigger>
          </TabsList>

          {/* Recycle bin explanation */}
          {tab === "bin" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3">
              <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Deleted entries are here. Restore them to move them back to your ledger.</span>
            </div>
          )}

          {["all", "cash_in", "cash_out", "bin", "sale_history"].map((t) => (
            <TabsContent key={t} value={t} className="space-y-2 mt-0">
              {t === "sale_history" ? (
                <SaleHistoryTable sales={saleHistory} isLoading={isSaleHistoryLoading} />
              ) : isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : visibleEntries.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  {t === "bin" ? (
                    <>
                      <Trash className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Recycle bin is empty</p>
                      <p className="text-xs mt-1">Deleted entries will appear here</p>
                    </>
                  ) : (
                    <p className="font-medium">No entries found</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-teal-50 dark:bg-teal-950/20">
                        <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
                        <th className="text-left py-2 px-2 border-b text-xs">Description</th>
                        <th className="text-left py-2 px-2 border-b text-xs">Date</th>
                        <th className="text-left py-2 px-2 border-b text-xs">Type</th>
                        <th className="text-right py-2 px-2 border-b text-xs">Amount</th>
                        <th className="text-right py-2 px-2 border-b text-xs">Profit</th>
                        <th className="text-right py-2 px-2 border-b text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...visibleEntries].sort((a, b) => {
                          const dt = new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
                          return dt !== 0 ? dt : b.id - a.id;
                        }).map((entry, idx) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          index={idx}
                          sale={saleHistory.find(sale => sale.entryId === entry.id)}
                          isDeleted={t === "bin"}
                          onEdit={setEditEntry}
                          onDelete={handleDelete}
                          onRestore={handleRestore}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {t === "all" && !isLoading && (
                <div className="mt-5 space-y-5">
                  {saleHistory.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Product Sale History</h3>
                      <SaleHistoryTable sales={saleHistory} isLoading={false} />
                    </div>
                  )}
                  {returnHistory.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Product Return History</h3>
                      <ReturnHistoryTable returns={[...returnHistory].sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())} />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {editEntry !== null && (
        <EditEntryDialog
          entryId={editEntry}
          onClose={() => setEditEntry(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
            setEditEntry(null);
          }}
        />
      )}
    </div>
  );
}
