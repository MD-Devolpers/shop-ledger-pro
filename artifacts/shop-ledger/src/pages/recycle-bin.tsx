import { useEffect, useState } from "react";
import { Trash2, RotateCcw, Loader2, AlertTriangle, RefreshCw, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useListEntries, useRestoreEntry } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Package, ClipboardList, ShoppingCart } from "lucide-react";

type BinInventory = {
  products: { id: number; name: string; code: string; stockQty: number; purchasePrice: number; salePrice: number; deletedAt: string }[];
  purchaseBills: { id: number; billNumber: string; supplierName: string | null; totalAmount: number; billDate: string; deletedAt: string }[];
  productSales: { id: number; customerName: string | null; totalAmount: number; saleDate: string; deletedAt: string }[];
};

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
  const [clearingAll, setClearingAll] = useState(false);
  const [restoringCredit, setRestoringCredit] = useState<number | null>(null);
  const [deletingCredit, setDeletingCredit] = useState<number | null>(null);

  const { data: deletedEntries = [], isLoading: entriesLoading, refetch: refetchEntries } = useListEntries(
    { deleted: true },
    { query: { staleTime: 0 } }
  );

  const {
    data: deletedCredits = [],
    isLoading: creditsLoading,
    refetch: refetchCredits,
  } = useQuery<any[]>({
    queryKey: ["recycle-bin-credits"],
    queryFn: async () => {
      const res = await fetch("/api/credits?deleted=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load deleted credits");
      return res.json();
    },
    staleTime: 0,
  });

  const restoreEntry = useRestoreEntry();

  const { data: inv, isLoading: invLoading, refetch: refetchInv } = useQuery<BinInventory>({
    queryKey: ["recycle-bin-inventory"],
    queryFn: async () => {
      const res = await fetch("/api/recycle-bin/inventory", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    staleTime: 0,
  });
  const [invBusy, setInvBusy] = useState<string | null>(null);

  const handleInvRestore = async (type: string, id: number, label: string) => {
    setInvBusy(`${type}-${id}`);
    try {
      const res = await fetch(`/api/recycle-bin/inventory/${type}/${id}/restore`, { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "Restored!", description: `"${label}" wapis aa gaya.` });
        refetchInv();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Restore failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setInvBusy(null);
    }
  };

  const handleInvPermanentDelete = async (type: string, id: number) => {
    if (!confirm("Permanently delete? This cannot be undone.")) return;
    setInvBusy(`${type}-${id}-del`);
    try {
      const res = await fetch(`/api/recycle-bin/inventory/${type}/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Permanently deleted" });
        refetchInv();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setInvBusy(null);
    }
  };

  useEffect(() => {
    document.title = "Recycle Bin - LedgerEntries";
  }, []);

  const refetchAll = () => {
    refetchEntries();
    refetchCredits();
    refetchInv();
  };

  const isLoading = entriesLoading || creditsLoading || invLoading;
  const invCount = (inv?.products.length ?? 0) + (inv?.purchaseBills.length ?? 0) + (inv?.productSales.length ?? 0);
  const totalItems = deletedEntries.length + deletedCredits.length + invCount;

  const handleRestoreEntry = (id: number, desc: string) => {
    restoreEntry.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Restored!", description: `"${desc || "Entry"}" has been restored.` });
          queryClient.invalidateQueries();
          refetchEntries();
        },
        onError: () => {
          toast({ title: "Restore failed", variant: "destructive" });
        },
      }
    );
  };

  const handlePermanentDeleteEntry = async (id: number) => {
    if (!confirm("Permanently delete this entry? This cannot be undone.")) return;
    setPermanentDeleting(id);
    try {
      const res = await fetch(`/api/entries/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Permanently deleted" });
        refetchEntries();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json();
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setPermanentDeleting(null);
    }
  };

  const handleRestoreCredit = async (id: number) => {
    setRestoringCredit(id);
    try {
      const res = await fetch(`/api/credits/${id}/restore`, { method: "POST" });
      if (res.ok) {
        toast({ title: "Credit restored!" });
        refetchCredits();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json();
        toast({ title: "Restore failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setRestoringCredit(null);
    }
  };

  const handlePermanentDeleteCredit = async (id: number) => {
    if (!confirm("Permanently delete this credit record? This cannot be undone.")) return;
    setDeletingCredit(id);
    try {
      const res = await fetch(`/api/credits/${id}/permanent`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Permanently deleted" });
        refetchCredits();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json();
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setDeletingCredit(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Permanently delete ALL ${deletedEntries.length} ledger entries? (Credits, products, bills & sales are not affected.) This CANNOT be undone.`)) return;
    setClearingAll(true);
    try {
      const res = await fetch("/api/entries/permanent-all", { method: "DELETE" });
      if (res.ok) {
        const d = await res.json();
        toast({ title: "Entries cleared", description: `${d.count} entries permanently deleted.` });
        refetchAll();
        queryClient.invalidateQueries();
      } else {
        const d = await res.json();
        toast({ title: "Failed", description: d.error, variant: "destructive" });
      }
    } finally {
      setClearingAll(false);
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
          <p className="text-xs text-muted-foreground">Deleted items — restore or remove permanently</p>
        </div>
        <div className="flex items-center gap-2">
          {totalItems > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="text-xs h-8 px-3"
              onClick={handleClearAll}
              disabled={clearingAll}
            >
              {clearingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Clear Entries
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={refetchAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <Trash2 className="h-10 w-10 opacity-30" />
            </div>
            <p className="font-medium text-base">Recycle bin is empty</p>
            <p className="text-sm mt-1">Deleted entries, credits, products, bills &amp; sales will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                {totalItems} deleted {totalItems === 1 ? "item" : "items"}.
                Restore to recover, or delete permanently.
              </p>
            </div>

            {/* ── Deleted Credits ── */}
            {deletedCredits.length > 0 && (
              <>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1">
                  Credit Records ({deletedCredits.length})
                </p>
                {(deletedCredits as any[]).map((credit) => (
                  <Card key={`credit-${credit.id}`} className="p-4 border-dashed opacity-80 hover:opacity-100 transition-opacity border-amber-200">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-50">
                        <Handshake className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-amber-700">
                            {formatAmount(credit.amount)}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            Credit {credit.type === "given" ? "Given" : "Received"}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${credit.status === "pending" ? "text-amber-600 border-amber-200" : "text-green-600 border-green-200"}`}>
                            {credit.status === "pending" ? "Pending" : "Paid"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground mt-0.5">{credit.customerName}</p>
                        {credit.description && (
                          <p className="text-xs text-muted-foreground truncate">{credit.description}</p>
                        )}
                        {credit.deletedAt && (
                          <p className="text-[10px] text-red-400 mt-0.5">
                            Deleted: {format(new Date(credit.deletedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handleRestoreCredit(credit.id)}
                          disabled={restoringCredit === credit.id}
                        >
                          {restoringCredit === credit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handlePermanentDeleteCredit(credit.id)}
                          disabled={deletingCredit === credit.id}
                        >
                          {deletingCredit === credit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            )}

            {/* ── Deleted Entries ── */}
            {deletedEntries.length > 0 && (
              <>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1 mt-2">
                  Ledger Entries ({deletedEntries.length})
                </p>
                {deletedEntries.map((entry) => {
                  const style = getTypeStyle(entry.type);
                  return (
                    <Card key={`entry-${entry.id}`} className="p-4 border-dashed opacity-80 hover:opacity-100 transition-opacity">
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
                            onClick={() => handleRestoreEntry(entry.id, entry.description || "")}
                            disabled={restoreEntry.isPending}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                            onClick={() => handlePermanentDeleteEntry(entry.id)}
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
              </>
            )}

            {/* ── Deleted Products ── */}
            {(inv?.products.length ?? 0) > 0 && (
              <>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1 mt-2">
                  Products ({inv!.products.length})
                </p>
                {inv!.products.map((p) => (
                  <Card key={`prod-${p.id}`} className="p-4 border-dashed opacity-80 hover:opacity-100 transition-opacity border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                        <Package className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">{p.code}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Stock: {p.stockQty}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Purchase {formatAmount(p.purchasePrice)} · Sale {formatAmount(p.salePrice)}
                        </p>
                        <p className="text-[10px] text-red-400 mt-0.5">
                          Deleted: {format(new Date(p.deletedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handleInvRestore("product", p.id, p.name)} disabled={invBusy === `product-${p.id}`}>
                          {invBusy === `product-${p.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Restore
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handleInvPermanentDelete("product", p.id)} disabled={invBusy === `product-${p.id}-del`}>
                          {invBusy === `product-${p.id}-del` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            )}

            {/* ── Deleted Purchase Bills ── */}
            {(inv?.purchaseBills.length ?? 0) > 0 && (
              <>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1 mt-2">
                  Purchase Bills ({inv!.purchaseBills.length})
                </p>
                {inv!.purchaseBills.map((b) => (
                  <Card key={`bill-${b.id}`} className="p-4 border-dashed opacity-80 hover:opacity-100 transition-opacity border-purple-200">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-50">
                        <ClipboardList className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold">{formatAmount(b.totalAmount)}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">{b.billNumber}</Badge>
                        </div>
                        {b.supplierName && <p className="text-sm font-medium mt-0.5">{b.supplierName}</p>}
                        <p className="text-xs text-muted-foreground">Bill date: {format(new Date(b.billDate), "MMM d, yyyy")}</p>
                        <p className="text-[10px] text-red-400 mt-0.5">
                          Deleted: {format(new Date(b.deletedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handleInvRestore("purchase-bill", b.id, b.billNumber)} disabled={invBusy === `purchase-bill-${b.id}`}>
                          {invBusy === `purchase-bill-${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Restore
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handleInvPermanentDelete("purchase-bill", b.id)} disabled={invBusy === `purchase-bill-${b.id}-del`}>
                          {invBusy === `purchase-bill-${b.id}-del` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            )}

            {/* ── Deleted Product Sales ── */}
            {(inv?.productSales.length ?? 0) > 0 && (
              <>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-1 mt-2">
                  Product Sales ({inv!.productSales.length})
                </p>
                {inv!.productSales.map((s) => (
                  <Card key={`sale-${s.id}`} className="p-4 border-dashed opacity-80 hover:opacity-100 transition-opacity border-emerald-200">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-50">
                        <ShoppingCart className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-emerald-700">{formatAmount(s.totalAmount)}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Sale</Badge>
                        </div>
                        {s.customerName && <p className="text-sm font-medium mt-0.5">{s.customerName}</p>}
                        <p className="text-xs text-muted-foreground">Sale date: {format(new Date(s.saleDate), "MMM d, yyyy")}</p>
                        <p className="text-[10px] text-red-400 mt-0.5">
                          Deleted: {format(new Date(s.deletedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => handleInvRestore("product-sale", s.id, s.customerName ?? "Sale")} disabled={invBusy === `product-sale-${s.id}`}>
                          {invBusy === `product-sale-${s.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Restore
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
                          onClick={() => handleInvPermanentDelete("product-sale", s.id)} disabled={invBusy === `product-sale-${s.id}-del`}>
                          {invBusy === `product-sale-${s.id}-del` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
