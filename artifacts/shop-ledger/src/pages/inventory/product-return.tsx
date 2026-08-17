import { useState } from "react";
import { useListProducts, useCreateProductReturn, useListProductReturns } from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function ProductReturn() {
  const { toast } = useToast();
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [returnAmount, setReturnAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isResalable, setIsResalable] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "digital">("cash");

  const { data: products = [] } = useListProducts({ search: productSearch || undefined });
  const { data: returns = [] } = useListProductReturns();
  const createReturn = useCreateProductReturn();

  const selectedProduct = products.find(p => p.id.toString() === selectedProductId);

  function handleSubmit() {
    if (!selectedProductId) { toast({ title: "Please select a product", variant: "destructive" }); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast({ title: "Please enter a valid quantity", variant: "destructive" }); return; }

    createReturn.mutate({
      productId: parseInt(selectedProductId),
      quantity: parseFloat(quantity),
      returnAmount: parseFloat(returnAmount) || 0,
      reason: reason.trim() || undefined,
      isResalable,
      paymentMethod,
    }, {
      onSuccess: () => {
        toast({ title: "✅ Product return saved", description: "Stock has been added back" });
        setSelectedProductId(""); setQuantity("1"); setReturnAmount(""); setReason("");
        setProductSearch(""); setIsResalable(true);
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
        <div>
          <Label>Product Search</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Product name ya code..." value={productSearch} onChange={e => { setProductSearch(e.target.value); setSelectedProductId(""); }} />
          </div>
          {productSearch && !selectedProductId && (
            <div className="mt-1 border rounded-lg overflow-hidden">
              {products.slice(0, 8).map(p => (
                <button key={p.id} onClick={() => { setSelectedProductId(p.id.toString()); setProductSearch(p.name); setReturnAmount(p.salePrice.toString()); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted flex justify-between text-sm">
                  <span>{p.name} <span className="text-muted-foreground font-mono text-xs">({p.code})</span></span>
                  <span className="text-muted-foreground">Stock: {p.stockQty}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="p-3 rounded-lg bg-muted/40 text-sm flex flex-wrap gap-3">
            <span>Purchase: <strong>{formatCurrency(selectedProduct.purchasePrice)}</strong></span>
            <span>Sale: <strong>{formatCurrency(selectedProduct.salePrice)}</strong></span>
            <span>Current Stock: <strong>{selectedProduct.stockQty}</strong></span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Return Quantity</Label><Input type="number" min="0.001" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div><Label>Return Amount (Rs)</Label><Input type="number" min="0" value={returnAmount} onChange={e => setReturnAmount(e.target.value)} placeholder="Amount to refund customer" /></div>
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
            <p className="text-xs text-muted-foreground mt-0.5">Used but good condition — resalable (will be added back to stock)</p>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={createReturn.isPending || !selectedProductId}>
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
