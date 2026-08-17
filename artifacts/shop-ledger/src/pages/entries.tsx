import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEntries,
  useDeleteEntry,
  useRestoreEntry,
  getListEntriesQueryKey,
  getGetReportSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingUp,
  TrendingDown,
  Trash2,
  Pencil,
  RotateCcw,
  Trash,
  CloudCheck,
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
};

function EntryRow({
  entry,
  index,
  onEdit,
  onDelete,
  onRestore,
  isDeleted,
}: {
  entry: Entry;
  index: number;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onRestore?: (id: number) => void;
  isDeleted?: boolean;
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
          <TabsList className="w-full mb-4 grid grid-cols-4">
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
          </TabsList>

          {/* Recycle bin explanation */}
          {tab === "bin" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3">
              <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Deleted entries are here. Restore them to move them back to your ledger.</span>
            </div>
          )}

          {["all", "cash_in", "cash_out", "bin"].map((t) => (
            <TabsContent key={t} value={t} className="space-y-2 mt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : !allEntries || allEntries.length === 0 ? (
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
                      {[...allEntries].sort((a, b) => {
                          const dt = new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
                          return dt !== 0 ? dt : b.id - a.id;
                        }).map((entry, idx) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          index={idx}
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
