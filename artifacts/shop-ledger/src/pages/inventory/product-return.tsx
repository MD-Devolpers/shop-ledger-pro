import { useMemo, useState } from "react";
import { useCreateProductReturn, useListProductReturns, useListProductSales } from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function ProductReturn() {
  const { toast } = useToast();
  const [productSearch, setProductSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [isResalable, setIsResalable] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "digital">("cash");

  const { data: sales = [] } = useListProductSales();
  const { data: returns = [] } = useListProductReturns();
  const createReturn = useCreateProductReturn();

  const productOptions = useMemo(() => {
    const products = new Map<number, { id: number; name: string; code: string }>();
    sales.forEach(sale => sale.items?.forEach(item => {
      if (!products.has(item.productId)) {
        products.set(item.productId, {
          id: item.productId,
          name: item.productName || "Product",
          code: item.productCode || "—",
        });
      }
    }));
    return [...products.values()];
  }, [sales]);
  const matchingProducts = productOptions.filter(product => {
    const query = productSearch.trim().toLowerCase();
    return !query || product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query);
  });
  const selectedSale = sales.find(s => s.id.toString() === selectedSaleId);
  const selectedItem = selectedSale?.items?.find(item => item.productId.toString() === selectedProductId);
  const returnLots = useMemo(() => sales
    .map(sale => {
      const item = sale.items?.find(line => line.productId.toString() === selectedProductId);
      if (!item) return null;
      const alreadyReturned = returns
        .filter((entry: any) => entry.saleId === sale.id && entry.productId === item.productId)
        .reduce((total: number, entry: any) => total + entry.quantity, 0);
      const soldQty = item.quantity;
      const remainingQty = Math.max(0, soldQty - alreadyReturned);
      const saleLinesTotal = sale.items?.reduce((total, line) => total + line.lineTotal, 0) ?? 0;
      const paidLineTotal = saleLinesTotal > 0 ? item.lineTotal * (sale.totalAmount / saleLinesTotal) : item.lineTotal;
      return {
        saleId: sale.id,
        remainingQty,
        refundPerUnit: soldQty > 0 ? paidLineTotal / soldQty : 0,
      };
    })
    .filter((lot): lot is { saleId: number; remainingQty: number; refundPerUnit: number } => lot !== null && lot.remainingQty > 0)
    .sort((a, b) => a.saleId - b.saleId), [sales, returns, selectedProductId]);
  const maxReturnQty = Math.floor(returnLots.reduce((total, lot) => total + lot.remainingQty, 0) + 0.000001);
  const qty = parseFloat(quantity) || 0;
  let remainingForPreview = qty;
  const returnAmount = Math.round(returnLots.reduce((total, lot) => {
    if (remainingForPreview <= 0) return total;
    const allocated = Math.min(remainingForPreview, lot.remainingQty);
    remainingForPreview -= allocated;
    return total + allocated * lot.refundPerUnit;
  }, 0) * 100) / 100;

  function handleSubmit() {
    if (!selectedProductId || maxReturnQty < 1) { toast({ title: "Please select a product with available sale quantity", variant: "destructive" }); return; }
    if (!quantity || qty <= 0 || !Number.isInteger(qty)) {
      toast({ title: "Return quantity must be a whole number (1, 2, 3...)", variant: "destructive" });
      return;
    }
    if (qty > maxReturnQty) { toast({ title: `Only ${maxReturnQty} can be returned from this sale`, variant: "destructive" }); return; }

    createReturn.mutate({
      productId: parseInt(selectedProductId),
      quantity: qty,
      reason: reason.trim() || undefined,
      isResalable,
      paymentMethod,
    }, {
      onSuccess: () => {
        toast({ title: "✅ Product return saved", description: `${formatCurrency(returnAmount)} refunded and stock added back` });
        setSelectedSaleId(""); setSelectedProductId(""); setQuantity("1"); setReason(""); setIsResalable(true);
      },
      onError: e => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Product Return</h1>
        <p className="text-muted-foreground text-sm">Returned product stock will be added back</p>
      </div>

      <div className="border rounded-xl p-5 bg-card space-y-4">
        <div className="grid gap-3">
          <div>
            <Label>Product Search</Label>
            <Input
              className="mt-1"
              placeholder="Search product name or code..."
              value={productSearch}
              onChange={e => {
                setProductSearch(e.target.value);
                setSelectedProductId("");
                setSelectedSaleId("");
                setQuantity("1");
              }}
            />
            {productSearch.trim() && !selectedProductId && matchingProducts.length > 0 && (
              <div className="mt-1 border rounded-lg overflow-hidden">
                {matchingProducts.slice(0, 8).map(product => (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted flex justify-between text-sm"
                    onClick={() => {
                    const nextSale = sales.find(sale => {
                      const item = sale.items?.find(line => line.productId === product.id);
                      if (!item) return false;
                      const returned = returns
                        .filter((entry: any) => entry.saleId === sale.id && entry.productId === product.id)
                        .reduce((total: number, entry: any) => total + entry.quantity, 0);
                      return item.quantity - returned > 0;
                    });
                      setProductSearch(product.name);
                      setSelectedProductId(product.id.toString());
                    setSelectedSaleId(nextSale?.id.toString() || "");
                      setQuantity("1");
                    }}
                  >
                    <span>{product.name} <span className="text-muted-foreground font-mono text-xs">({product.code})</span></span>
                    <span className="text-primary text-xs">Select</span>
                  </button>
                ))}
              </div>
            )}
            {selectedProductId && (
              <div className="mt-1 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span>Selected: <strong>{productOptions.find(product => product.id.toString() === selectedProductId)?.name}</strong></span>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                  setProductSearch("");
                  setSelectedProductId("");
                  setSelectedSaleId("");
                  setQuantity("1");
                }}>Change</Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Return Quantity (whole units)</Label>
            <Input
              className="mt-1"
              type="text"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              placeholder="Enter quantity"
              value={quantity}
              disabled={!selectedProductId || maxReturnQty < 1}
              onKeyDown={e => {
                if ([".", ",", "e", "E", "+", "-"].includes(e.key)) e.preventDefault();
              }}
              onPaste={e => {
                if (!/^[1-9]\d*$/.test(e.clipboardData.getData("text").trim())) e.preventDefault();
              }}
              onChange={e => {
                const nextValue = e.target.value;
                if (nextValue === "" || /^[1-9]\d*$/.test(nextValue)) setQuantity(nextValue);
              }}
            />
          </div>
          <div><Label>Return Amount (Rs)</Label><Input readOnly value={selectedProductId ? returnAmount.toFixed(2) : ""} placeholder="Automatically calculated from the sales" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="digital">Digital</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Return Reason (Optional)</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Defective item" /></div>
        </div>
        {/* Resalable toggle */}
        <div className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${isResalable ? "bg-green-50 border-green-200" : "bg-muted/30"}`}
          onClick={() => setIsResalable(v => !v)}>
          <input type="checkbox" id="resalable" checked={isResalable} onChange={e => setIsResalable(e.target.checked)} className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <label htmlFor="resalable" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-green-600" />Resalable
            </label>
          <p className="text-xs text-muted-foreground mt-0.5">Return stock is added back automatically; this marks its condition for history.</p>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={createReturn.isPending || !selectedProductId || qty <= 0 || qty > maxReturnQty}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {createReturn.isPending ? "Saving..." : "Save Return"}
        </Button>
      </div>

      {/* Return History */}
      {returns.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Return History</h2>
          {returns.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 border rounded-xl bg-card">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.productName}</span>
                  <Badge variant="outline" className="text-xs font-mono">{r.productCode}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(r.returnDate), "dd MMM yyyy")} • Qty: {r.quantity}{r.reason ? ` • ${r.reason}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(r.returnAmount)}</p>
                <Badge variant="outline" className="text-xs capitalize">{r.paymentMethod}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
