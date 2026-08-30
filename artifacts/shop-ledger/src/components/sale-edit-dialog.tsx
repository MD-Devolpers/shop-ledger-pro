import { useEffect, useMemo, useState } from "react";
import {
  useGetProductSale,
  useGetSaleHistory,
  useListProducts,
  useUpdateProductSale,
  type Product,
  type ProductSaleItem,
} from "@/lib/inventory-api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditLine {
  productId: number;
  quantity: string;
  salePrice: string;
  discount: string;
  discountType: "fixed" | "percent";
  originalQuantity: number;
}

function inputDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function lineTotal(line: EditLine) {
  const quantity = Number(line.quantity) || 0;
  const price = Number(line.salePrice) || 0;
  const discount = Number(line.discount) || 0;
  const gross = quantity * price;
  return line.discountType === "percent"
    ? Math.max(0, gross * (1 - discount / 100))
    : Math.max(0, gross - discount);
}

export function SaleEditDialog({
  saleId,
  open,
  onClose,
}: {
  saleId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: sale, isLoading } = useGetProductSale(saleId);
  const { data: history = [] } = useGetSaleHistory(saleId);
  const { data: products = [] } = useListProducts();
  const updateSale = useUpdateProductSale();
  const [customerName, setCustomerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "digital">("cash");
  const [isCredit, setIsCredit] = useState(false);
  const [saleDate, setSaleDate] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [addProductId, setAddProductId] = useState("");

  useEffect(() => {
    if (!open || !sale) return;
    setCustomerName(sale.customerName ?? "");
    setContactNumber(sale.contactNumber ?? "");
    setPaymentMethod(sale.paymentMethod);
    setIsCredit(sale.isCredit);
    setSaleDate(inputDate(sale.saleDate));
    setNotes(sale.notes ?? "");
    setReason("");
    setLines((sale.items ?? []).map((item: ProductSaleItem) => ({
      productId: item.productId,
      quantity: String(item.quantity),
      salePrice: String(item.salePrice),
      discount: String(item.discount ?? 0),
      discountType: item.discountType === "percent" ? "percent" : "fixed",
      originalQuantity: item.quantity,
    })));
  }, [open, sale]);

  const productById = useMemo(
    () => new Map(products.map(product => [product.id, product])),
    [products],
  );
  const usedProductIds = new Set(lines.map(line => line.productId));
  const availableProducts = products.filter(product => !usedProductIds.has(product.id) && product.deletedAt == null);
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  function updateLine(index: number, patch: Partial<EditLine>) {
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function addProduct(productId: string) {
    const product = productById.get(Number(productId));
    if (!product) return;
    setLines(current => [...current, {
      productId: product.id,
      quantity: "1",
      salePrice: String(product.salePrice),
      discount: "0",
      discountType: "fixed",
      originalQuantity: 0,
    }]);
    setAddProductId("");
  }

  function validate() {
    if (lines.length === 0) return "At least one product is required";
    if (isCredit && !customerName.trim()) return "Customer name is required for a credit sale";
    if (!reason.trim()) return "Please enter a reason for this edit";
    for (const line of lines) {
      const product = productById.get(line.productId);
      const quantity = Number(line.quantity);
      const price = Number(line.salePrice);
      const discount = Number(line.discount);
      if (!product) return "One selected product is no longer available";
      if (!Number.isFinite(quantity) || quantity <= 0) return `${product.name}: quantity must be greater than zero`;
      const available = product.stockQty + line.originalQuantity;
      if (quantity > available) return `${product.name}: only ${available} available after restoring the original sale quantity`;
      if (!Number.isFinite(price) || price < 0) return `${product.name}: enter a valid sale price`;
      if (!Number.isFinite(discount) || discount < 0) return `${product.name}: enter a valid discount`;
      if (line.discountType === "percent" && discount > 100) return `${product.name}: discount cannot exceed 100%`;
      if (line.discountType === "fixed" && discount > quantity * price) return `${product.name}: discount cannot exceed line total`;
    }
    return null;
  }

  function handleSave() {
    const error = validate();
    if (error) {
      toast({ title: "Cannot update sale", description: error, variant: "destructive" });
      return;
    }
    updateSale.mutate({
      id: saleId,
      data: {
        customerName: customerName.trim() || undefined,
        contactNumber: contactNumber.trim() || undefined,
        paymentMethod,
        isCredit,
        saleDate,
        notes: notes.trim() || undefined,
        reason: reason.trim(),
        discount: sale?.discount ?? 0,
        discountType: sale?.discountType === "percent" ? "percent" : "fixed",
        items: lines.map(line => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          salePrice: Number(line.salePrice),
          discount: Number(line.discount) || 0,
          discountType: line.discountType,
        })),
      },
    }, {
      onSuccess: () => {
        toast({ title: "Sale updated", description: "Stock, ledger, credit, and reports were updated together." });
        onClose();
      },
      onError: error => {
        toast({ title: "Sale update failed", description: error.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sale #{saleId}</DialogTitle>
          <DialogDescription>Correct this sale safely. Stock, ledger, credit, and reports update together.</DialogDescription>
        </DialogHeader>

        {isLoading || !sale ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading sale…
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Input value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Optional for paid sale" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Input value={contactNumber} onChange={event => setContactNumber(event.target.value)} placeholder="Phone number" />
              </div>
              <div className="space-y-1.5">
                <Label>Sale date</Label>
                <Input type="date" value={saleDate} onChange={event => setSaleDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment</Label>
                <Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as "cash" | "digital")} disabled={isCredit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <Checkbox checked={isCredit} onCheckedChange={checked => setIsCredit(checked === true)} />
              This is a customer credit sale
            </label>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Products</h3>
                <span className="font-bold text-emerald-700">{new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(total)}</span>
              </div>
              {lines.map((line, index) => {
                const product = productById.get(line.productId) as Product | undefined;
                return (
                  <div key={`${line.productId}-${index}`} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-12 sm:items-end">
                    <div className="space-y-1 sm:col-span-4">
                      <Label>Product</Label>
                      <Select value={String(line.productId)} onValueChange={value => {
                        const nextProduct = productById.get(Number(value));
                        if (!nextProduct) return;
                        updateLine(index, { productId: nextProduct.id, salePrice: String(nextProduct.salePrice), originalQuantity: 0 });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {products.filter(item => item.id === line.productId || !usedProductIds.has(item.id)).map(item => (
                            <SelectItem key={item.id} value={String(item.id)}>{item.name} ({item.stockQty})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Quantity</Label>
                      <Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={event => updateLine(index, { quantity: event.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Sale price</Label>
                      <Input type="number" min="0" step="0.01" value={line.salePrice} onChange={event => updateLine(index, { salePrice: event.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Discount</Label>
                      <Input type="number" min="0" step="0.01" value={line.discount} onChange={event => updateLine(index, { discount: event.target.value })} />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <Select value={line.discountType} onValueChange={value => updateLine(index, { discountType: value as "fixed" | "percent" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Rs</SelectItem>
                          <SelectItem value="percent">%</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))} aria-label={`Remove ${product?.name ?? "product"}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {availableProducts.length > 0 && (
                <div className="flex max-w-md items-center gap-2">
                  <Select value={addProductId} onValueChange={addProduct}>
                    <SelectTrigger><SelectValue placeholder="Add another product" /></SelectTrigger>
                    <SelectContent>
                      {availableProducts.map(product => (
                        <SelectItem key={product.id} value={String(product.id)}>{product.name} ({product.stockQty})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Sale note" />
              </div>
              <div className="space-y-1.5">
                <Label>Edit reason *</Label>
                <Textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Why is this sale being corrected?" />
              </div>
            </div>

            {history.length > 0 && (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <h3 className="text-sm font-semibold">Change History</h3>
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {history.map((item: any) => (
                    <div key={item.id} className="rounded-lg bg-background p-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium capitalize">{item.editType} by {item.editedByName || "Unknown"}</span>
                        <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString("en-PK")}</span>
                      </div>
                      {item.reason && <p className="mt-1 text-muted-foreground">Reason: {item.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onClose} disabled={updateSale.isPending}>Cancel</Button>
              <Button onClick={handleSave} disabled={updateSale.isPending}>
                {updateSale.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Sale Changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}