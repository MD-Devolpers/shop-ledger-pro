import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListCompanies, useListCategories, useListCollections, useCreatePurchaseBill,
  useToggleFavorite, useGetPriceHistory, useBulkAssignCompany,
  type Product,
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Search, AlertTriangle, Package, History, PackagePlus, Star, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function StockBadge({ product }: { product: Product }) {
  const qty = product.availableStock ?? product.stockQty;
  if (product.stockStatus === "out") return <Badge variant="destructive">Out of Stock</Badge>;
  if (product.stockStatus === "low")
    return <Badge className="bg-yellow-500 text-white hover:bg-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" />Low: {qty}</Badge>;
  return <Badge className="bg-green-600 text-white hover:bg-green-700">{qty}</Badge>;
}

// ─── Restock Dialog ───────────────────────────────────────────────────────────
function RestockDialog({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: companies = [] } = useListCompanies();
  const createBill = useCreatePurchaseBill();

  const [supplier, setSupplier] = useState("");
  const [companyId, setCompanyId] = useState("none");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [qty, setQty] = useState("1");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [saleRate, setSaleRate] = useState("");
  const [updatePrices, setUpdatePrices] = useState(true);

  // Pre-fill rates from product
  function resetAndPrefill(p: Product | null) {
    setSupplier(p?.companyName ?? "");
    setCompanyId("none");
    setBillNo("");
    setBillDate(new Date().toISOString().split("T")[0]);
    setQty("1");
    setPurchaseRate(p ? String(p.purchasePrice) : "");
    setSaleRate(p ? String(p.salePrice) : "");
    setUpdatePrices(true);
  }

  // When product changes, prefill
  if (open && product && purchaseRate === "" && product.purchasePrice) {
    setPurchaseRate(String(product.purchasePrice));
    setSaleRate(String(product.salePrice));
    setSupplier(product.companyName ?? "");
  }

  const total = Math.max(0, (parseFloat(qty) || 0) * (parseFloat(purchaseRate) || 0));

  function handleSave() {
    if (!product) return;
    if (!supplier.trim()) { toast({ title: "Supplier name required", variant: "destructive" }); return; }
    if (parseFloat(qty) <= 0) { toast({ title: "Qty must be > 0", variant: "destructive" }); return; }

    const billNumber = billNo.trim() || `STK-${Date.now()}`;

    createBill.mutate({
      supplierName: supplier.trim(),
      companyId: companyId !== "none" ? companyId : undefined,
      billNumber,
      billDate,
      updateProductPrices: updatePrices,
      items: [{
        productId: product.id,
        quantity: parseFloat(qty) || 1,
        purchaseRate: parseFloat(purchaseRate) || 0,
        saleRate: parseFloat(saleRate) || 0,
        discount: 0,
      }],
    }, {
      onSuccess: () => {
        toast({ title: "✅ Stock added", description: `${product.name} → +${qty} units` });
        resetAndPrefill(null);
        onClose();
      },
      onError: e => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
    });
  }

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { resetAndPrefill(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-green-600" />
            Add Stock — {product.name}
          </DialogTitle>
        </DialogHeader>

        {/* Product info */}
        <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/30 rounded-lg text-sm">
          <Badge variant="outline" className="font-mono">{product.code}</Badge>
          {product.companyName && <span className="text-muted-foreground">🏭 {product.companyName}</span>}
          <span className="ml-auto font-semibold">
            Current Stock: <span className={product.stockStatus === "out" ? "text-red-600" : product.stockStatus === "low" ? "text-yellow-600" : "text-green-700"}>
              {product.availableStock ?? product.stockQty}
            </span>
          </span>
        </div>

        <div className="space-y-3">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Supplier Name *</Label>
              <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier / Company" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Company (Master)</Label>
              <Select value={companyId} onValueChange={v => { setCompanyId(v); if (v !== "none") { const c = companies.find(c => c.id.toString() === v); if (c && !supplier) setSupplier(c.name); } }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bill No & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bill No (Optional)</Label>
              <Input value={billNo} onChange={e => setBillNo(e.target.value)} placeholder="e.g. INV-001" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Qty + Rates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">Quantity *</Label>
              <Input type="number" min="0.001" step="any" value={qty} onChange={e => setQty(e.target.value)} className="mt-1 text-center font-bold text-lg" />
            </div>
            <div>
              <Label className="text-xs">Purchase Rate</Label>
              <Input type="number" min="0" step="any" value={purchaseRate} onChange={e => setPurchaseRate(e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Sale Rate</Label>
              <Input type="number" min="0" step="any" value={saleRate} onChange={e => setSaleRate(e.target.value)} placeholder="0" className="mt-1 text-green-700" />
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm text-muted-foreground">Total Cost:</span>
            <span className="font-bold text-blue-700">{fmt(total)}</span>
          </div>

          {/* Update prices checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox id="upx-restock" checked={updatePrices} onCheckedChange={v => setUpdatePrices(!!v)} />
            <label htmlFor="upx-restock" className="text-xs cursor-pointer text-muted-foreground leading-tight">
              Also update the product's purchase/sale rates
            </label>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={() => { resetAndPrefill(null); onClose(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={createBill.isPending} className="bg-green-600 hover:bg-green-700">
            <PackagePlus className="h-4 w-4 mr-1" />Add Stock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add/Edit Product Dialog ──────────────────────────────────────────────────
const EMPTY_FORM = {
  code: "", name: "", companyId: "", categoryId: "", collectionId: "",
  purchasePrice: "", salePrice: "", minSalePrice: "", stockQty: "0", minStockAlert: "0", expiryDate: "",
};

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function Products() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Filters
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStock, setFilterStock] = useState("all");

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Restock dialog
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);

  const { data: products = [], isLoading } = useListProducts({
    search: search || undefined,
    companyId: filterCompany !== "all" ? parseInt(filterCompany) : undefined,
    categoryId: filterCategory !== "all" ? parseInt(filterCategory) : undefined,
    stockStatus: filterStock !== "all" ? filterStock : undefined,
  });
  const { data: companies = [] } = useListCompanies();
  const { data: categories = [] } = useListCategories();
  const { data: collections = [] } = useListCollections();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const toggleFavorite = useToggleFavorite();
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);
  const { data: priceHistory = [], isLoading: priceHistoryLoading } = useGetPriceHistory(priceHistoryProduct?.id ?? null);

  function openAdd() { navigate("/inventory/bulk-purchase"); }
  function openEdit(p: Product) {
    setEditProduct(p);
    setForm({
      code: p.code, name: p.name,
      companyId: p.companyId?.toString() ?? "",
      categoryId: p.categoryId?.toString() ?? "",
      collectionId: p.collectionId?.toString() ?? "",
      purchasePrice: p.purchasePrice.toString(),
      salePrice: p.salePrice.toString(),
      minSalePrice: p.minSalePrice != null ? p.minSalePrice.toString() : "",
      stockQty: p.stockQty.toString(),
      minStockAlert: p.minStockAlert.toString(),
      expiryDate: p.expiryDate ? p.expiryDate.split("T")[0] : "",
    });
    setDialogOpen(true);
  }
  function openRestock(p: Product) { setRestockProduct(p); setRestockOpen(true); }

  const createBill = useCreatePurchaseBill();
  const bulkAssignCompany = useBulkAssignCompany();

  async function handleAssignCompany() {
    if (filterCompany === "all") {
      toast({ title: "Select a company filter first", variant: "destructive" }); return;
    }
    const ids = products.map(p => p.id);
    if (ids.length === 0) { toast({ title: "No products to assign" }); return; }
    try {
      const r = await bulkAssignCompany.mutateAsync({ companyId: parseInt(filterCompany), productIds: ids });
      const cname = companies.find(c => c.id.toString() === filterCompany)?.name ?? "";
      toast({ title: `✅ ${r.updated} products assigned to ${cname}` });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "Code and Name are required", variant: "destructive" }); return;
    }
    const data = {
      code: form.code.trim(), name: form.name.trim(),
      companyId: form.companyId || null,
      categoryId: form.categoryId || null,
      collectionId: form.collectionId || null,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      salePrice: parseFloat(form.salePrice) || 0,
      minSalePrice: form.minSalePrice.trim() !== "" ? parseFloat(form.minSalePrice) : null,
      stockQty: parseFloat(form.stockQty) || 0,
      minStockAlert: parseFloat(form.minStockAlert) || 0,
      expiryDate: form.expiryDate || null,
    };
    if (editProduct) {
      updateProduct.mutate({ id: editProduct.id, ...(data as any) }, {
        onSuccess: () => { toast({ title: "Product updated ✅" }); setDialogOpen(false); },
        onError: e => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
      });
    } else {
      try {
        const newProduct = await createProduct.mutateAsync(data as any);
        // Auto-create purchase bill if stock > 0
        if (data.stockQty > 0) {
          const supplierName = companies.find(c => c.id.toString() === form.companyId)?.name ?? "Direct Purchase";
          await createBill.mutateAsync({
            supplierName,
            companyId: form.companyId || undefined,
            billNumber: `ADD-${newProduct.code}-${Date.now()}`,
            billDate: new Date().toISOString().split("T")[0],
            updateProductPrices: false,
            items: [{
              productId: newProduct.id,
              quantity: data.stockQty,
              purchaseRate: data.purchasePrice,
              saleRate: data.salePrice,
              discount: 0,
            }],
          });
          toast({ title: "Product added ✅", description: `Opening stock of ${data.stockQty} saved to Purchase Report` });
        } else {
          toast({ title: "Product added ✅" });
        }
        setDialogOpen(false);
      } catch (e) {
        toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      }
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm">{products.length} products</p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />Add New Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterCompany !== "all" && products.length > 0 && (
          <Button
            size="sm" variant="outline"
            className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={handleAssignCompany}
            disabled={bulkAssignCompany.isPending}
            title="Assign this company to all filtered products that don't have one"
          >
            {bulkAssignCompany.isPending ? "Assigning..." : `Assign Company → ${products.length} products`}
          </Button>
        )}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStock} onValueChange={setFilterStock}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Stock" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
            <SelectItem value="expiry">Expiring Soon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm text-center py-10">Loading...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No products found</p>
          <Button variant="outline" className="mt-3" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />Add Product
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-50 dark:bg-teal-950/20">
                <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
                <th className="text-left py-2 px-2 border-b text-xs">Product</th>
                <th className="text-left py-2 px-2 border-b text-xs">Company</th>
                <th className="text-left py-2 px-2 border-b text-xs">Category</th>
                <th className="text-right py-2 px-2 border-b text-xs">Stock</th>
                <th className="text-right py-2 px-2 border-b text-xs">Purchase</th>
                <th className="text-right py-2 px-2 border-b text-xs">Sale</th>
                <th className="text-right py-2 px-2 border-b text-xs">Min Alert</th>
                <th className="text-right py-2 px-2 border-b text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p, idx) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="text-center py-2 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{p.name}</span>
                      <Badge variant="outline" className="text-xs font-mono">{p.code}</Badge>
                      {(p.pendingReplacementQty ?? 0) > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">🔄 {p.pendingReplacementQty}</Badge>
                      )}
                      {p.expiryDate && new Date(p.expiryDate) <= new Date(Date.now() + 30 * 86400000) && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />{format(new Date(p.expiryDate), "dd MMM yy")}
                        </Badge>
                      )}
                    </div>
                    {p.collectionName && <div className="text-xs text-muted-foreground mt-0.5">📦 {p.collectionName}</div>}
                  </td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{p.companyName ?? "—"}</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{p.categoryName ?? "—"}</td>
                  <td className="text-right py-2 px-2"><StockBadge product={p} /></td>
                  <td className="text-right py-2 px-2 font-medium">{fmt(p.purchasePrice)}</td>
                  <td className="text-right py-2 px-2 font-medium text-green-700">{fmt(p.salePrice)}</td>
                  <td className="text-right py-2 px-2">{p.minStockAlert}</td>
                  <td className="py-2 px-2">
                    <div className="flex gap-0.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800 font-semibold h-7 px-2"
                        onClick={() => openRestock(p)}
                        title="Add More Stock"
                      >
                        <PackagePlus className="h-3.5 w-3.5 mr-1" />Add
                      </Button>
                      <Button
                        size="icon" variant="ghost" className={`h-7 w-7 ${p.isFavorite ? "text-yellow-500" : "text-muted-foreground"}`}
                        title={p.isFavorite ? "Quick Product (Remove)" : "Quick Product (Add)"}
                        onClick={() => toggleFavorite.mutate(p.id, { onSuccess: (r) => toast({ title: r.isFavorite ? "⭐ Added to Quick Products" : "Removed from Quick Products" }) })}
                      >
                        <Star className={`h-4 w-4 ${p.isFavorite ? "fill-yellow-400" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Price History" onClick={() => setPriceHistoryProduct(p)}>
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Stock History" onClick={() => navigate(`/inventory/product-history?productId=${p.id}`)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteProduct.mutate(p.id, { onSuccess: () => toast({ title: "Product deleted" }) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Product Code *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. CAB-001" className="mt-1" />
              </div>
              <div>
                <Label>Product Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. USB Cable" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Company</Label>
                <Select value={form.companyId || "none"} onValueChange={v => setForm(f => ({ ...f, companyId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.categoryId || "none"} onValueChange={v => setForm(f => ({ ...f, categoryId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Collection</Label>
                <Select value={form.collectionId || "none"} onValueChange={v => setForm(f => ({ ...f, collectionId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {collections.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Purchase Price (Rs)</Label>
                <Input type="number" min="0" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Sale Price (Rs)</Label>
                <Input type="number" min="0" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Min Sale Price / Max Discount Limit (optional)</Label>
              <Input type="number" min="0" value={form.minSalePrice} onChange={e => setForm(f => ({ ...f, minSalePrice: e.target.value }))} placeholder="e.g. 950 — sales below this price not allowed" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Sale screen par agar price is se kam ho to warning aayegi</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Initial Stock Quantity</Label>
                <Input type="number" min="0" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Min Stock Alert</Label>
                <Input type="number" min="0" value={form.minStockAlert} onChange={e => setForm(f => ({ ...f, minStockAlert: e.target.value }))} placeholder="e.g. 5" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Expiry Date (Optional)</Label>
              <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>
              {editProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <RestockDialog
        product={restockProduct}
        open={restockOpen}
        onClose={() => { setRestockOpen(false); setRestockProduct(null); }}
      />

      {/* Price History Dialog */}
      <Dialog open={!!priceHistoryProduct} onOpenChange={open => { if (!open) setPriceHistoryProduct(null); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>💰 Price History — {priceHistoryProduct?.name}</DialogTitle>
          </DialogHeader>
          {priceHistoryLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : priceHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No price history found</p>
              <p className="text-xs mt-1">Prices are automatically recorded when a purchase bill is saved</p>
            </div>
          ) : (
            <div className="space-y-2">
              {priceHistory.map((h, i) => (
                <div key={h.id} className={`border rounded-xl p-3 ${i === 0 ? "border-teal-200 bg-teal-50" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{format(new Date(h.createdAt), "dd MMM yyyy · HH:mm")}</span>
                    {i === 0 && <Badge className="bg-teal-600 text-white text-xs">Latest</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {h.purchasePrice !== null && (
                      <div>
                        <p className="text-xs text-muted-foreground">Purchase Price</p>
                        <p className="font-semibold">{fmt(h.purchasePrice)}</p>
                      </div>
                    )}
                    {h.salePrice !== null && (
                      <div>
                        <p className="text-xs text-muted-foreground">Sale Price</p>
                        <p className="font-semibold text-green-700">{fmt(h.salePrice)}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="capitalize">{h.source === "purchase" ? "📦 Purchase Bill" : "✏️ Manual"}</span>
                    {h.billNumber && <span>· Bill #{h.billNumber}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
