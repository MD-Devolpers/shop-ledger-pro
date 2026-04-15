import { useEffect, useState } from "react";
import { Trash2, RotateCcw, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useListEntries, useRestoreEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

function formatAmount(n: number | string) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(Number(n));
}

export default function RecycleBin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [permanentDeleting, setPermanentDeleting] = useState<number | null>(null);

  const { data: deletedEntries = [], isLoading, refetch } = useListEntries(
    { deleted: true },
    { query: { staleTime: 0 } }
  );

  const restoreEntry = useRestoreEntry();

  useEffect(() => {
    document.title = "Recycle Bin - LedgerEntries";
  }, []);

  const handleRestore = (id: number, desc: string) => {
    restoreEntry.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Restored!", description: `"${desc || "Entry"}" has been restored.` });
          queryClient.invalidateQueries();
          refetch();
        },
        onError: () => {
          toast({ title: "Restore failed", variant: "destructive" });
        },
      }
    );
  };

  const handlePermanentDelete = async (id: number) => {
    if (!confirm("Permanently delete this entry? This cannot be undone.")) return;
    setPermanentDeleting(id);
    try {
      const res = await fetch(`/api/entries/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Permanently deleted" });
        refetch();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json();
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setPermanentDeleting(null);
    }
  };

  const getTypeStyle = (type: string) => {
    return type === "cash_in"
      ? { bg: "bg-green-50", text: "text-green-700", label: "Cash In" }
      : { bg: "bg-red-50", text: "text-red-700", label: "Cash Out" };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Recycle Bin
          </h1>
          <p className="text-xs text-muted-foreground">Deleted entries — restore or remove permanently</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : deletedEntries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <Trash2 className="h-10 w-10 opacity-30" />
            </div>
            <p className="font-medium text-base">Recycle bin is empty</p>
            <p className="text-sm mt-1">Deleted entries will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                {deletedEntries.length} deleted {deletedEntries.length === 1 ? "entry" : "entries"}.
                Restore to recover, or delete permanently.
              </p>
            </div>

            {deletedEntries.map((entry) => {
              const style = getTypeStyle(entry.type);
              return (
                <Card key={entry.id} className="p-4 border-dashed opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Trash2 className={`h-5 w-5 ${style.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold ${style.text}`}>
                          {formatAmount(entry.amount)}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {style.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {entry.paymentMethod === "digital" ? "Digital" : "Cash"}
                        </Badge>
                        {entry.isCredit && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0">
                            Credit
                          </Badge>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{entry.description}</p>
                      )}
                      {entry.customerName && (
                        <p className="text-xs text-muted-foreground">{entry.customerName}</p>
                      )}
                      {entry.deletedAt && (
                        <p className="text-[10px] text-red-400 mt-0.5">
                          Deleted: {format(new Date(entry.deletedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => handleRestore(entry.id, entry.description || "")}
                        disabled={restoreEntry.isPending}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                        onClick={() => handlePermanentDelete(entry.id)}
                        disabled={permanentDeleting === entry.id}
                      >
                        {permanentDeleting === entry.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Trash2 className="h-3 w-3" />}
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
