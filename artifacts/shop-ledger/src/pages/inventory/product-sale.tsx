import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts, useCreateProductSale, useGetBillSettings, useListMobilePurchases, useSellMobile, type Product, type MobilePurchase } from "@/lib/inventory-api";
import { useGetMe, useListCredits } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Trash2, ShoppingCart, Search, Star, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const WARRANTY_OPTIONS = [
  { value: "7d", label: "7 Days" },
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "custom", label: "Custom" },
];

interface SaleLine {
  product: Product;
  quantity: string;
  salePrice: string;
  discountType: "percent" | "fixed";
  discount: string;
  warrantyPeriod: string;
  warrantyCustomDays: string;
}

interface MobileLine {
  mobile: MobilePurchase;
  salePrice: string;
}

// ─── Per-line discount display helper ──────────────────────────────────────────
function discountPercent(line: SaleLine): string {
  const sp = parseFloat(line.salePrice) || 0;
  const qty = parseFloat(line.quantity) || 1;
  const disc = parseFloat(line.discount) || 0;
  if (sp === 0 || disc === 0) return "";
  if (line.discountType === "percent") return "";          // already percent
  const pct = (disc / (qty * sp)) * 100;
  if (!isFinite(pct) || pct <= 0) return "";
  return pct.toFixed(1) + "%";
}

function discountFixedFromPct(line: SaleLine): string {
  const sp = parseFloat(line.salePrice) || 0;
  const qty = parseFloat(line.quantity) || 1;
  const disc = parseFloat(line.discount) || 0;
  if (sp === 0 || disc === 0) return "";
  if (line.discountType === "fixed") return "";
  const amt = (disc / 100) * qty * sp;
  if (!isFinite(amt) || amt <= 0) return "";
  return "Rs " + amt.toFixed(0);
}

export default function ProductSale() {
  const { data: me } = useGetMe();
  const isAdmin = (me as any)?.role === "admin";

  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [mobileLines, setMobileLines] = useState<MobileLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "digital">("cash");
  const [isCredit, setIsCredit] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const { data: products = [] } = useListProducts({ search: productSearch || undefined });
  const { data: mobileResults = [] } = useListMobilePurchases(
    productSearch.trim() ? { search: productSearch, status: "in_stock" } : undefined
  );
  const { data: favoriteProducts = [] } = useListProducts({ favorites: true });
  const { data: billSettings } = useGetBillSettings();
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const { data: allCredits = [] } = useListCredits();

  // Build per-customer pending balance
  const customerBalances = (allCredits as any[]).reduce<Record<string, number>>((acc, c) => {
    const name = c.customerName;
    if (!name) return acc;
    if (!acc[name]) acc[name] = 0;
    if (c.status === "pending") {
      if (c.type === "given") acc[name] += parseFloat(c.amount ?? 0);
      else if (c.type === "received") acc[name] -= parseFloat(c.amount ?? 0);
    }
    return acc;
  }, {});
  const savedCustomers = Object.entries(customerBalances)
    .map(([name, balance]) => ({ name, balance }))
    .sort((a, b) => b.balance - a.balance);
  const quickShortcut = (billSettings?.quickProductShortcut ?? "").trim().toLowerCase();
  const isQuickSearch = quickShortcut.length > 0 && productSearch.trim().toLowerCase() === quickShortcut;
  const createSale = useCreateProductSale();
  const sellMobile = useSellMobile();

  const filteredProducts = products.filter(p => p.stockQty > 0);
  const quickInStock = favoriteProducts.filter(p => p.stockQty > 0);

  function addProduct(p: Product) {
    if (lines.find(l => l.product.id === p.id)) {
      toast({ title: "Product already added", description: "Increase the quantity instead" });
      return;
    }
    setLines(prev => [...prev, {
      product: p,
      quantity: "1",
      salePrice: p.salePrice.toString(),
      discountType: "percent",
      discount: "0",
      warrantyPeriod: "",
      warrantyCustomDays: "",
    }]);
    setProductSearch("");
  }

  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)); }

  function addMobile(m: MobilePurchase) {
    if (mobileLines.find(ml => ml.mobile.id === m.id)) {
      toast({ title: "Mobile already added", description: "This mobile is already in the cart" });
      return;
    }
    setMobileLines(prev => [...prev, { mobile: m, salePrice: (m.salePrice ?? 0).toString() }]);
    setProductSearch("");
  }

  function removeMobileLine(i: number) { setMobileLines(l => l.filter((_, idx) => idx !== i)); }

  function setMobilePrice(i: number, value: string) {
    setMobileLines(l => { const next = [...l]; next[i] = { ...next[i], salePrice: value }; return next; });
  }

  function mobileLineTotal(ml: MobileLine): number { return parseFloat(ml.salePrice) || 0; }
  function mobileLineProfit(ml: MobileLine): number { return mobileLineTotal(ml) - (ml.mobile.purchasePrice ?? 0); }

  function setLineField(i: number, key: keyof SaleLine, value: string) {
    setLines(l => { const next = [...l]; (next[i] as any)[key] = value; return next; });
  }

  function lineUnitPrice(line: SaleLine): number {
    const qty = parseFloat(line.quantity) || 0;
    if (qty === 0) return 0;
    return lineTotal(line) / qty;
  }

  function lineTotal(line: SaleLine): number {
    const qty = parseFloat(line.quantity) || 0;
    const sp = parseFloat(line.salePrice) || 0;
    const disc = parseFloat(line.discount) || 0;
    if (line.discountType === "percent") return qty * sp * (1 - disc / 100);
    return Math.max(0, qty * sp - disc);
  }

  function lineProfit(line: SaleLine): number {
    const qty = parseFloat(line.quantity) || 0;
    return lineTotal(line) - qty * line.product.purchasePrice;
  }

  function isLoss(line: SaleLine): boolean { return lineProfit(line) < 0; }

  function isBelowMinPrice(line: SaleLine): boolean {
    const minP = line.product.minSalePrice;
    if (!minP || minP <= 0) return false;
    return lineUnitPrice(line) < minP;
  }

  const mobileTotal = mobileLines.reduce((s, ml) => s + mobileLineTotal(ml), 0);
  const mobileProfit = mobileLines.reduce((s, ml) => s + mobileLineProfit(ml), 0);
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0) + mobileTotal;
  const totalProfit = lines.reduce((s, l) => s + lineProfit(l), 0) + mobileProfit;
  const hasLoss = lines.some(l => isLoss(l)) || mobileLines.some(ml => mobileLineProfit(ml) < 0);
  const totalItems = lines.length + mobileLines.length;

  // Sell each mobile line via the dedicated endpoint.
  // Returns the sold-price total of successes, the failed lines, and successfully sold count.
  async function sellMobileLines(): Promise<{ soldCount: number; soldTotal: number; failed: MobileLine[] }> {
    const failed: MobileLine[] = [];
    let soldCount = 0;
    let soldTotal = 0;
    const isoSaleDate = saleDate ? new Date(saleDate).toISOString() : undefined;
    for (const ml of mobileLines) {
      try {
        await sellMobile.mutateAsync({
          id: ml.mobile.id,
          data: {
            soldToName: customerName.trim() || undefined,
            soldToPhone: contactNumber.trim() || undefined,
            saleAmount: mobileLineTotal(ml),
            paymentMethod,
            saleDate: isoSaleDate,
            isCredit,
          },
        });
        soldCount++;
        soldTotal += mobileLineTotal(ml);
      } catch (e) {
        failed.push(ml);
        toast({
          title: `📱 ${ml.mobile.mobileModel} sell failed`,
          description: (e as Error).message,
          variant: "destructive",
        });
      }
    }
    // Keep only the failed mobile lines in the cart so the user can retry
    setMobileLines(failed);
    // Refresh ledger entries + reports so overall profit (for company-sourced mobiles) updates
    qc.invalidateQueries({
      predicate: q => {
        const k = q.queryKey?.[0];
        return typeof k === "string" && (k.startsWith("/api/entries") || k.startsWith("/api/reports"));
      },
    });
    return { soldCount, soldTotal, failed };
  }

  async function handleSubmit() {
    if (totalItems === 0) { toast({ title: "Add at least one product or mobile", variant: "destructive" }); return; }

    for (const l of lines) {
      const qty = parseFloat(l.quantity) || 0;
      if (qty <= 0) { toast({ title: `${l.product.name}: Quantity must be greater than 0`, variant: "destructive" }); return; }
      if (qty > l.product.stockQty) { toast({ title: `${l.product.name}: Only ${l.product.stockQty} in stock`, variant: "destructive" }); return; }
    }

    if (isCredit && !customerName.trim()) { toast({ title: "Customer name is required for credit sale", variant: "destructive" }); return; }

    // Mobiles-only sale — skip the product-sale endpoint entirely
    if (lines.length === 0) {
      const { soldCount, soldTotal, failed } = await sellMobileLines();
      if (failed.length > 0) {
        // Some mobiles failed — stay on the page; failed lines remain in the cart for retry
        toast({
          title: `⚠️ ${failed.length} mobile(s) failed`,
          description: `${soldCount} sold (${formatCurrency(soldTotal)}). Retry: ${failed.map(f => f.mobile.mobileModel).join(", ")}`,
          variant: "destructive",
        });
        return;
      }
      if (soldCount > 0) {
        toast({ title: "✅ Sale saved!", description: `${soldCount} mobile(s) · ${formatCurrency(soldTotal)}` });
        navigate("/app");
      }
      return;
    }

    createSale.mutate({
      customerName: customerName.trim() || undefined,
      contactNumber: contactNumber.trim() || undefined,
      paymentMethod,
      isCredit,
      discount: 0,
      discountType: "fixed",
      notes: notes.trim() || undefined,
      saleDate,
      items: lines.map(l => ({
        productId: l.product.id,
        quantity: parseFloat(l.quantity),
        purchasePrice: l.product.purchasePrice,
        salePrice: parseFloat(l.salePrice),
        discount: parseFloat(l.discount) || 0,
        discountType: l.discountType,
        warrantyPeriod: l.warrantyPeriod || undefined,
        warrantyCustomDays: l.warrantyPeriod === "custom" ? parseInt(l.warrantyCustomDays) || 0 : undefined,
      })),
    }, {
      onSuccess: async () => {
        const productCount = lines.length;
        const productTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
        // Products already saved; now sell mobile lines separately
        if (mobileLines.length > 0) {
          const { soldCount, soldTotal, failed } = await sellMobileLines();
          if (failed.length > 0) {
            // Products + some mobiles succeeded, but not all mobiles.
            // Clear product lines (they're saved) and keep only failed mobiles for retry — do NOT navigate.
            setLines([]);
            toast({
              title: `⚠️ ${failed.length} mobile(s) failed`,
              description: `Saved: ${productCount} product(s) + ${soldCount} mobile(s) (${formatCurrency(productTotal + soldTotal)}). Retry: ${failed.map(f => f.mobile.mobileModel).join(", ")}`,
              variant: "destructive",
            });
            return;
          }
          toast({ title: "✅ Sale saved!", description: `${productCount} product(s) + ${soldCount} mobile(s) · ${formatCurrency(productTotal + soldTotal)}` });
          navigate("/app");
          return;
        }
        toast({ title: "✅ Sale saved!", description: `${productCount} product(s) · ${formatCurrency(productTotal)}` });
        navigate("/app");
      },
      onError: e => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
    });
  }

  const showQuickPanel = totalItems === 0 && !productSearch;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Product Sale</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/inventory/product-reports?tab=sales")} className="shrink-0 text-xs gap-1">
          <ExternalLink className="h-3.5 w-3.5" />Sale History
        </Button>
      </div>

      {/* Quick Products shortcut hint */}
      {quickShortcut && favoriteProducts.length > 0 && (
        <div className="text-xs text-muted-foreground bg-teal-50 border border-teal-100 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Star className="h-3 w-3 text-yellow-500 fill-yellow-400" />
          Type <span className="font-mono bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-semibold">{billSettings?.quickProductShortcut}</span>
          to show all {favoriteProducts.length} Quick Products
        </div>
      )}

      {/* Product search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={quickShortcut ? `Search... or type "${billSettings?.quickProductShortcut}" for quick products` : "Search by product name or code..."}
          value={productSearch}
          onChange={e => setProductSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Quick Products panel — shortcut triggered */}
      {isQuickSearch && (
        <div className="border border-teal-200 rounded-xl bg-teal-50/50 shadow-sm">
          <div className="px-3 py-2 border-b border-teal-200 text-xs font-semibold text-teal-700 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" />
            Quick Products ({quickInStock.length} in stock)
          </div>
          {quickInStock.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No Quick Products in stock</p>
          ) : (
            <div className="divide-y max-h-52 overflow-y-auto">
              {quickInStock.map(p => (
                <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left p-3 hover:bg-teal-100/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} · Stock: {p.stockQty}</p></div>
                    <span className="text-sm font-semibold text-teal-700">Rs {(p.salePrice ?? 0).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Normal search results */}
      {productSearch && !isQuickSearch && (
        <div className="border rounded-xl divide-y bg-card shadow-sm max-h-52 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No product found or out of stock</p>
          ) : (
            filteredProducts.map(p => (
              <button key={p.id} onClick={() => addProduct(p)} className="w-full text-left p-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.name} {p.isFavorite ? <Star className="inline h-3 w-3 fill-yellow-400 text-yellow-500" /> : null}</p>
                    <p className="text-xs text-muted-foreground">{p.code} · Stock: {p.stockQty}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-teal-700">Rs {(p.salePrice ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Pr: Rs {(p.purchasePrice ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Mobile search results */}
      {productSearch.trim() && !isQuickSearch && mobileResults.length > 0 && (
        <div className="border border-teal-200 rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-teal-100 bg-teal-50 text-xs font-semibold text-teal-700">
            📱 Mobiles ({mobileResults.length})
          </div>
          <div className="divide-y max-h-52 overflow-y-auto">
            {mobileResults.map(m => {
              const already = !!mobileLines.find(ml => ml.mobile.id === m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => addMobile(m)}
                  disabled={already}
                  className="w-full text-left p-3 hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.mobileModel} <span className="text-xs text-muted-foreground">· {m.company}</span></p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.imei ? `IMEI: ${m.imei}` : "No IMEI"}{already ? " · already added" : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-teal-700">Rs {(m.salePrice ?? 0).toLocaleString()}</p>
                      <Badge className="text-xs h-5 bg-green-600 text-white">In Stock</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state — show Quick Products inline */}
      {showQuickPanel && (
        <div className="border-2 border-dashed rounded-xl overflow-hidden">
          {quickInStock.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Search for a product above</p>
              <p className="text-xs mt-1">Or <button onClick={() => navigate("/inventory/quick-products")} className="text-teal-600 hover:underline">manage Quick Products</button> for quick access</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" />Quick Products
                </span>
                <button onClick={() => navigate("/inventory/quick-products")} className="text-xs text-teal-600 hover:underline flex items-center gap-1">
                  Manage <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y">
                {quickInStock.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)} className="text-left p-3 hover:bg-teal-50 transition-colors group">
                    <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.code}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-teal-700">Rs {(p.salePrice ?? 0).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">Stk: {p.stockQty}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Sale lines */}
      {totalItems > 0 && (
        <div className="space-y-3">
          {lines.map((line, i) => {
            const loss = isLoss(line);
            const belowMin = isBelowMinPrice(line);
            const anyWarn = loss || belowMin;
            const autoDiscPct = discountPercent(line);
            const autoDiscAmt = discountFixedFromPct(line);
            const unitPrice = lineUnitPrice(line);

            return (
              <div key={line.product.id} className={`border rounded-xl p-3 space-y-3 bg-card ${anyWarn ? "border-red-300" : ""}`}>
                {/* Product header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{line.product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{line.product.code}</span>
                      <Badge className={`text-xs h-5 ${line.product.stockQty <= 0 ? "bg-red-500" : line.product.stockQty <= (line.product.minStockAlert || 0) ? "bg-yellow-500" : "bg-green-600"} text-white`}>
                        Stock: {line.product.stockQty}
                      </Badge>
                      <span className="text-xs font-medium text-teal-700">Normal: Rs {(line.product.salePrice ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeLine(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Qty + Sale Price + Discount */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" className="h-8 text-sm mt-1" min={1} value={line.quantity}
                      onChange={e => setLineField(i, "quantity", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Sale Price</Label>
                    <Input type="number" className="h-8 text-sm mt-1" value={line.salePrice}
                      onChange={e => setLineField(i, "salePrice", e.target.value)} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">Discount</Label>
                    <div className="flex gap-1 mt-1">
                      <Input type="number" className="h-8 text-sm" value={line.discount}
                        onChange={e => setLineField(i, "discount", e.target.value)} />
                      <Select value={line.discountType} onValueChange={v => setLineField(i, "discountType", v)}>
                        <SelectTrigger className="h-8 w-14 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Rs</SelectItem>
                          <SelectItem value="percent">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Auto discount % / amount display */}
                    {autoDiscPct && (
                      <p className="text-xs text-muted-foreground mt-0.5">≈ {autoDiscPct} discount</p>
                    )}
                    {autoDiscAmt && (
                      <p className="text-xs text-muted-foreground mt-0.5">≈ {autoDiscAmt} off</p>
                    )}
                  </div>
                </div>

                {/* Warranty row */}
                <div className="border-t pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Warranty:</span>
                  <Select value={line.warrantyPeriod || "none"} onValueChange={v => setLineField(i, "warrantyPeriod", v === "none" ? "" : v)}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Warranty</SelectItem>
                      {WARRANTY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {line.warrantyPeriod === "custom" && (
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-7 w-20 text-xs" min={1} placeholder="Days" value={line.warrantyCustomDays}
                        onChange={e => setLineField(i, "warrantyCustomDays", e.target.value)} />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  )}
                  {line.warrantyPeriod && (
                    <span className="text-xs text-teal-600 font-medium">✓ Warranty included</span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate("/inventory/warranty-check")}
                    className="ml-auto text-xs text-teal-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />Check Warranty
                  </button>
                </div>

                {/* Price / Profit summary */}
                <div className={`rounded-lg px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1 items-center ${anyWarn ? "bg-red-50 border border-red-200" : "bg-muted/30"}`}>
                  <span className={`font-bold text-sm ${anyWarn ? "text-red-700" : "text-teal-700"}`}>
                    = {formatCurrency(lineTotal(line))}
                  </span>
                  {(parseFloat(line.discount) || 0) > 0 && (
                    <span className="text-muted-foreground">
                      Disc: {line.discountType === "percent"
                        ? `${line.discount}%${autoDiscAmt ? ` (${autoDiscAmt})` : ""}`
                        : `Rs ${line.discount}${autoDiscPct ? ` (${autoDiscPct})` : ""}`}
                    </span>
                  )}
                  <span className={lineProfit(line) >= 0 ? "text-green-700" : "text-red-600"}>
                    Profit: {formatCurrency(lineProfit(line))}
                  </span>
                  {/* Purchase price — subtle, at the end */}
                  <span className="text-muted-foreground">
                    Cost: Rs {(line.product.purchasePrice ?? 0).toLocaleString()}
                  </span>
                </div>

                {/* Loss / min price warnings */}
                {loss && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    ⚠️ LOSS WARNING — Sale price is below purchase price!
                  </div>
                )}
                {!loss && belowMin && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-700 text-xs font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    ⚠️ Below minimum sale price (Rs {line.product.minSalePrice?.toLocaleString()})!
                  </div>
                )}
              </div>
            );
          })}

          {/* Mobile lines */}
          {mobileLines.map((ml, i) => {
            const profit = mobileLineProfit(ml);
            const loss = profit < 0;
            return (
              <div key={`mobile-${ml.mobile.id}`} className={`border rounded-xl p-3 space-y-3 bg-card ${loss ? "border-red-300" : "border-teal-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">📱 {ml.mobile.mobileModel}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{ml.mobile.company}</span>
                      {ml.mobile.imei && <span className="text-xs text-muted-foreground font-mono">IMEI: {ml.mobile.imei}</span>}
                      <Badge className="text-xs h-5 bg-green-600 text-white">Qty: 1</Badge>
                      <span className="text-xs font-medium text-teal-700">Expected: Rs {(ml.mobile.salePrice ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeMobileLine(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" className="h-8 text-sm mt-1 bg-muted/40" value={1} disabled />
                  </div>
                  <div>
                    <Label className="text-xs">Sale Price</Label>
                    <Input type="number" className="h-8 text-sm mt-1" value={ml.salePrice}
                      onChange={e => setMobilePrice(i, e.target.value)} />
                  </div>
                </div>

                <div className={`rounded-lg px-3 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1 items-center ${loss ? "bg-red-50 border border-red-200" : "bg-muted/30"}`}>
                  <span className={`font-bold text-sm ${loss ? "text-red-700" : "text-teal-700"}`}>
                    = {formatCurrency(mobileLineTotal(ml))}
                  </span>
                  <span className={profit >= 0 ? "text-green-700" : "text-red-600"}>
                    Profit: {formatCurrency(profit)}
                  </span>
                  <span className="text-muted-foreground">
                    Cost: Rs {(ml.mobile.purchasePrice ?? 0).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    {ml.mobile.purchaseSource === "person" ? "Source: Person (report only)" : "Source: Company"}
                  </span>
                </div>

                {loss && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    ⚠️ LOSS WARNING — Sale price is below purchase price!
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total */}
          <div className={`rounded-xl px-4 py-3 text-right border ${hasLoss ? "bg-red-50 border-red-200" : "bg-teal-50 border-teal-200"}`}>
            <div className="flex items-center justify-between">
              <div className="text-left text-xs text-muted-foreground">
                <p>Total Profit: <span className={totalProfit >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>{formatCurrency(totalProfit)}</span></p>
                {hasLoss && <p className="text-red-600 font-medium mt-0.5">⚠️ Some items are being sold at a loss!</p>}
              </div>
              <div>
                <p className={`text-xs mb-0.5 ${hasLoss ? "text-red-700" : "text-teal-700"}`}>Grand Total</p>
                <p className={`text-2xl font-bold ${hasLoss ? "text-red-700" : "text-teal-700"}`}>{formatCurrency(grandTotal)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer / payment info */}
      {totalItems > 0 && (
        <div className="space-y-3 border rounded-xl p-4">
          <p className="font-semibold text-sm">Customer Info</p>

          {/* Credit toggle — top of section, prominent */}
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border cursor-pointer select-none transition-colors ${
              isCredit ? "bg-orange-50 border-orange-300" : "bg-muted/20 border-border hover:border-orange-300"
            }`}
            onClick={() => setIsCredit(v => !v)}
          >
            <input
              type="checkbox"
              id="isCredit"
              checked={isCredit}
              onChange={e => setIsCredit(e.target.checked)}
              onClick={e => e.stopPropagation()}
              className="h-4 w-4 accent-orange-500"
            />
            <div className="flex-1">
              <Label htmlFor="isCredit" className="cursor-pointer text-sm font-semibold">
                Credit Sale (payment later)
              </Label>
              {isCredit && (
                <p className="text-xs text-orange-700 mt-0.5">
                  Type customer name — will be auto-saved in the Credits section
                </p>
              )}
            </div>
            <span className={`text-lg ${isCredit ? "opacity-100" : "opacity-30"}`}>🟠</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Label className={`text-xs font-medium ${isCredit ? "text-orange-700" : ""}`}>
                Customer Name {isCredit ? <span className="text-red-500">*</span> : "(optional)"}
              </Label>
              <Input
                className={`h-8 text-sm mt-1 ${isCredit && !customerName.trim() ? "border-orange-400 focus:ring-orange-400" : ""}`}
                value={customerName}
                onChange={e => { setCustomerName(e.target.value); setShowCustomerDropdown(true); }}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                placeholder={isCredit ? "Enter customer name..." : "Customer name..."}
                autoFocus={isCredit}
                autoComplete="off"
              />
              {showCustomerDropdown && savedCustomers.length > 0 && (() => {
                const filtered = savedCustomers.filter(c =>
                  !customerName.trim() || c.name.toLowerCase().includes(customerName.toLowerCase())
                );
                if (filtered.length === 0) return null;
                return (
                  <div className="absolute z-50 top-full mt-0.5 left-0 right-0 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/20">
                      Existing Customers
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filtered.map(c => (
                        <button
                          key={c.name}
                          type="button"
                          onMouseDown={() => { setCustomerName(c.name); setShowCustomerDropdown(false); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-orange-50 transition-colors text-left"
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {c.name[0]?.toUpperCase()}
                            </span>
                            <span className="font-medium">{c.name}</span>
                          </span>
                          {c.balance > 0 && (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              Rs {c.balance.toLocaleString()} pending
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <Label className="text-xs">Contact (optional)</Label>
              <Input className="h-8 text-sm mt-1" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="Phone..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sale Date</Label>
              <Input type="date" className="h-8 mt-1" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (Optional)</Label>
            <Input className="h-8 text-sm mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note..." />
          </div>
        </div>
      )}

      {totalItems > 0 && (
        <Button
          size="lg"
          className={`w-full ${isCredit ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
          onClick={handleSubmit}
          disabled={createSale.isPending || sellMobile.isPending}
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          {createSale.isPending || sellMobile.isPending
            ? "Saving..."
            : isCredit
              ? `Save Credit · ${formatCurrency(grandTotal)}`
              : `Save Sale · ${formatCurrency(grandTotal)}`}
        </Button>
      )}
    </div>
  );
}
