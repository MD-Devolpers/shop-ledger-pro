import { useState, useRef } from "react";
import {
  useListProductSales, useGetProductSale, useListProducts, useGetBillSettings,
  useListCompanies, useListCategories, type ProductSale
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Printer, Download, Search, TrendingUp, ShoppingBag, BarChart3, Boxes, CalendarDays, Package } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number) { return n.toLocaleString("en-PK"); }

// ─── Bill Print Modal ─────────────────────────────────────────────────────────

function BillModal({ saleId, open, onClose }: { saleId: number | null; open: boolean; onClose: () => void }) {
  const { data: sale } = useGetProductSale(saleId);
  const { data: settings } = useGetBillSettings();
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    win.document.write(`
      <html><head><title>Invoice</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
        h1 { font-size: 22px; margin: 0 0 4px; color: #0d7e6a; }
        .sub { font-size: 12px; color: #666; margin: 2px 0; }
        .info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f0fdf9; color: #0d7e6a; text-align: left; padding: 8px 6px; border-bottom: 1px solid #d1fae5; }
        td { padding: 7px 6px; border-bottom: 1px solid #f3f4f6; }
        .total-row td { font-weight: bold; background: #f0fdf9; }
        .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        @media print { @page { margin: 10mm; } }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close(); win.focus(); win.print(); win.close();
  }

  async function handleDownloadPDF() {
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
    pdf.save(`Invoice-${sale?.id ?? "bill"}.pdf`);
  }

  if (!sale) return null;
  const saleDate = format(new Date(sale.saleDate), "dd MMM yyyy");
  const items = sale.items ?? [];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Invoice / Bill</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}><Download className="h-4 w-4 mr-1" />Download PDF</Button>
        </div>
        <div ref={printRef} className="bg-white text-black p-6 rounded-lg border text-sm">
          <div className="text-center border-b-2 border-emerald-700 pb-3 mb-4">
            {settings?.logo && <img src={settings.logo} alt="Logo" className="h-14 mx-auto mb-2 object-contain" />}
            <h1 className="text-xl font-bold text-emerald-700">{settings?.shopName || "Shop Name"}</h1>
            {settings?.address && <p className="sub text-gray-500 text-xs whitespace-pre-line">{settings.address}</p>}
            {settings?.mobile && <p className="sub text-gray-500 text-xs">📞 {settings.mobile}</p>}
          </div>
          <div className="info grid grid-cols-2 gap-2 text-xs mb-4">
            <div><span className="text-gray-500">Invoice #:</span> <strong>{sale.id}</strong></div>
            <div><span className="text-gray-500">Date:</span> <strong>{saleDate}</strong></div>
            {sale.customerName && <div><span className="text-gray-500">Customer:</span> <strong>{sale.customerName}</strong></div>}
            {sale.contactNumber && <div><span className="text-gray-500">Contact:</span> <strong>{sale.contactNumber}</strong></div>}
            <div><span className="text-gray-500">Payment:</span> <strong className="capitalize">{sale.paymentMethod}</strong></div>
            {sale.isCredit && <div><Badge className="text-xs bg-yellow-100 text-yellow-800">Credit Sale</Badge></div>}
          </div>
          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="bg-emerald-50">
                <th className="text-left p-2 border border-gray-200">Product</th>
                <th className="text-right p-2 border border-gray-200">Qty</th>
                <th className="text-right p-2 border border-gray-200">Rate</th>
                <th className="text-right p-2 border border-gray-200">Disc</th>
                <th className="text-right p-2 border border-gray-200">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="p-2 border border-gray-200">
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-gray-400 font-mono text-xs">{item.productCode}</div>
                  </td>
                  <td className="text-right p-2 border border-gray-200">{item.quantity}</td>
                  <td className="text-right p-2 border border-gray-200">{fmt(item.salePrice)}</td>
                  <td className="text-right p-2 border border-gray-200">
                    {item.discount > 0 ? (item.discountType === "percent" ? `${item.discount}%` : fmt(item.discount)) : "-"}
                  </td>
                  <td className="text-right p-2 border border-gray-200 font-medium">{fmt(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {sale.discount > 0 && (
                <tr>
                  <td colSpan={4} className="text-right p-2 text-gray-500">Discount:</td>
                  <td className="text-right p-2 text-red-600">-{fmt(sale.discount)}</td>
                </tr>
              )}
              <tr className="bg-emerald-50 font-bold">
                <td colSpan={4} className="text-right p-2 border-t-2 border-emerald-700">Total:</td>
                <td className="text-right p-2 border-t-2 border-emerald-700 text-emerald-700">{fmt(sale.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
          {sale.notes && <p className="text-xs text-gray-500 mb-3 italic">Note: {sale.notes}</p>}
          {settings?.footer && <div className="footer text-center text-xs text-gray-400 border-t pt-3 mt-3">{settings.footer}</div>}
        </div>
        <Button variant="ghost" onClick={onClose} className="mt-2">Close</Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sales Table ──────────────────────────────────────────────────────────────

function SalesTable({ sales, onViewBill }: { sales: ProductSale[]; onViewBill: (id: number) => void }) {
  if (sales.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">No sales records found</p>
    </div>
  );
  return (
    <div className="space-y-2">
      {sales.map(s => (
        <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-xl bg-card hover:bg-muted/20 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">Sale #{s.id}</span>
              {s.customerName && <span className="text-muted-foreground text-sm">• {s.customerName}</span>}
              {s.isCredit && <Badge className="text-xs bg-yellow-100 text-yellow-800">Credit</Badge>}
              <Badge variant="outline" className="text-xs capitalize">{s.paymentMethod}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(s.saleDate), "dd MMM yyyy, h:mm a")}</p>
          </div>
          <div className="flex gap-4 shrink-0 text-sm">
            <div className="text-center"><p className="text-muted-foreground text-xs">Amount</p><p className="font-bold">{fmt(s.totalAmount)}</p></div>
            <div className="text-center"><p className="text-muted-foreground text-xs">Profit</p><p className={`font-bold ${s.totalProfit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(s.totalProfit)}</p></div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onViewBill(s.id)}>
            <Eye className="h-3.5 w-3.5 mr-1" />View Bill
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Stock Value Report ───────────────────────────────────────────────────────

function StockValueReport() {
  const [filterType, setFilterType] = useState<"all" | "company" | "category" | "product">("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState("all");

  const { data: products = [], isLoading } = useListProducts();
  const { data: companies = [] } = useListCompanies();
  const { data: categories = [] } = useListCategories();
  // Filtered product list
  const filtered = products.filter(p => {
    if (filterType === "company" && selectedCompany !== "all" && p.companyId?.toString() !== selectedCompany) return false;
    if (filterType === "category" && selectedCategory !== "all" && p.categoryId?.toString() !== selectedCategory) return false;
    if (filterType === "product" && selectedProduct !== "all" && p.id.toString() !== selectedProduct) return false;
    return true;
  });

  const totalQty = filtered.reduce((s, p) => s + (p.availableStock ?? p.stockQty), 0);
  const totalPurchaseVal = filtered.reduce((s, p) => s + (p.availableStock ?? p.stockQty) * p.purchasePrice, 0);
  const totalSaleVal = filtered.reduce((s, p) => s + (p.availableStock ?? p.stockQty) * p.salePrice, 0);
  const totalProfit = totalSaleVal - totalPurchaseVal;

  // Company-wise breakdown
  const companyWise: Record<string, { name: string; qty: number; purchaseVal: number; saleVal: number }> = {};
  for (const p of filtered) {
    const key = p.companyId?.toString() ?? "none";
    const label = p.companyName ?? "No Company";
    if (!companyWise[key]) companyWise[key] = { name: label, qty: 0, purchaseVal: 0, saleVal: 0 };
    const qty = p.availableStock ?? p.stockQty;
    companyWise[key].qty += qty;
    companyWise[key].purchaseVal += qty * p.purchasePrice;
    companyWise[key].saleVal += qty * p.salePrice;
  }

  // Category-wise breakdown
  const categoryWise: Record<string, { name: string; qty: number; purchaseVal: number; saleVal: number }> = {};
  for (const p of filtered) {
    const key = p.categoryId?.toString() ?? "none";
    const label = p.categoryName ?? "No Category";
    if (!categoryWise[key]) categoryWise[key] = { name: label, qty: 0, purchaseVal: 0, saleVal: 0 };
    const qty = p.availableStock ?? p.stockQty;
    categoryWise[key].qty += qty;
    categoryWise[key].purchaseVal += qty * p.purchasePrice;
    categoryWise[key].saleVal += qty * p.salePrice;
  }

  // Compute a human-readable label for the active filter
  const filterLabel = (() => {
    if (filterType === "all") return null;
    if (filterType === "company") {
      if (selectedCompany === "all") return "All Companies";
      return companies.find(c => c.id.toString() === selectedCompany)?.name ?? "Company";
    }
    if (filterType === "category") {
      if (selectedCategory === "all") return "All Categories";
      return categories.find(c => c.id.toString() === selectedCategory)?.name ?? "Category";
    }
    if (filterType === "product") {
      if (selectedProduct === "all") return "All Products";
      const p = products.find(p => p.id.toString() === selectedProduct);
      return p ? `${p.name} (${p.code})` : "Product";
    }
    return null;
  })();

  return (
    <div className="space-y-5">

      {/* Filters — above the cards so selection is visually linked */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        {(["all", "company", "category", "product"] as const).map(t => (
          <Button
            key={t}
            size="sm"
            variant={filterType === t ? "default" : "outline"}
            onClick={() => setFilterType(t)}
            className="h-7 text-xs capitalize"
          >
            {t === "all" ? "All Products" : t === "company" ? "Company-wise" : t === "category" ? "Category-wise" : "Product-wise"}
          </Button>
        ))}
        {filterType === "company" && (
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Select company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {filterType === "category" && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {filterType === "product" && (
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Big Summary Cards — reactive to the filter above */}
      <div className="space-y-1.5">
        {filterLabel && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
            Showing: <span className="text-foreground">{filterLabel}</span>
            {" · "}{filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </p>
        )}
        {/* Row 1: Stock + Payment (the two key numbers) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border-2 border-blue-300 rounded-xl p-4 bg-blue-50">
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Stock</p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{fmtNum(totalQty)}</p>
            <p className="text-xs text-blue-500 mt-0.5">units in hand</p>
          </div>
          <div className="border-2 border-orange-300 rounded-xl p-4 bg-orange-50">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">💰 Total Payment</p>
            </div>
            <p className="text-3xl font-bold text-orange-700">{fmt(totalPurchaseVal)}</p>
            <p className="text-xs text-orange-500 mt-0.5">amount invested in stock</p>
          </div>
        </div>
        {/* Row 2: Sale Value + Profit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-xl p-3 bg-green-50 text-center">
            <p className="text-xs font-semibold text-green-600 mb-1">Expected Sale Value</p>
            <p className="text-lg font-bold text-green-700">{fmt(totalSaleVal)}</p>
            <p className="text-xs text-green-500 mt-0.5">if all stock sold</p>
          </div>
          <div className="border rounded-xl p-3 bg-purple-50 text-center">
            <p className="text-xs font-semibold text-purple-600 mb-1">Expected Profit</p>
            <p className="text-lg font-bold text-purple-700">{fmt(totalProfit)}</p>
            <p className="text-xs text-purple-500 mt-0.5">on full sale</p>
          </div>
        </div>
      </div>

      {/* Company-wise breakdown table */}
      {filterType === "company" && selectedCompany === "all" && (
        <div>
          <h3 className="font-semibold mb-2 text-sm">Company-wise Stock Value</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-2 px-3 border">Company</th>
                  <th className="text-right py-2 px-3 border">Stock Qty</th>
                  <th className="text-right py-2 px-3 border">Purchase Value</th>
                  <th className="text-right py-2 px-3 border">Sale Value</th>
                  <th className="text-right py-2 px-3 border">Exp. Profit</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(companyWise).sort((a, b) => b.purchaseVal - a.purchaseVal).map((c, i) => (
                  <tr key={i} className="border-b hover:bg-muted/10">
                    <td className="py-2 px-3 border font-medium">{c.name}</td>
                    <td className="text-right py-2 px-3 border">{fmtNum(c.qty)}</td>
                    <td className="text-right py-2 px-3 border text-orange-700">{fmt(c.purchaseVal)}</td>
                    <td className="text-right py-2 px-3 border text-green-700">{fmt(c.saleVal)}</td>
                    <td className="text-right py-2 px-3 border text-purple-700">{fmt(c.saleVal - c.purchaseVal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-bold">
                  <td className="py-2 px-3 border">Total</td>
                  <td className="text-right py-2 px-3 border">{fmtNum(totalQty)}</td>
                  <td className="text-right py-2 px-3 border text-orange-700">{fmt(totalPurchaseVal)}</td>
                  <td className="text-right py-2 px-3 border text-green-700">{fmt(totalSaleVal)}</td>
                  <td className="text-right py-2 px-3 border text-purple-700">{fmt(totalProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Category-wise breakdown table */}
      {filterType === "category" && selectedCategory === "all" && (
        <div>
          <h3 className="font-semibold mb-2 text-sm">Category-wise Stock Value</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-2 px-3 border">Category</th>
                  <th className="text-right py-2 px-3 border">Stock Qty</th>
                  <th className="text-right py-2 px-3 border">Purchase Value</th>
                  <th className="text-right py-2 px-3 border">Sale Value</th>
                  <th className="text-right py-2 px-3 border">Exp. Profit</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(categoryWise).sort((a, b) => b.purchaseVal - a.purchaseVal).map((c, i) => (
                  <tr key={i} className="border-b hover:bg-muted/10">
                    <td className="py-2 px-3 border font-medium">{c.name}</td>
                    <td className="text-right py-2 px-3 border">{fmtNum(c.qty)}</td>
                    <td className="text-right py-2 px-3 border text-orange-700">{fmt(c.purchaseVal)}</td>
                    <td className="text-right py-2 px-3 border text-green-700">{fmt(c.saleVal)}</td>
                    <td className="text-right py-2 px-3 border text-purple-700">{fmt(c.saleVal - c.purchaseVal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-bold">
                  <td className="py-2 px-3 border">Total</td>
                  <td className="text-right py-2 px-3 border">{fmtNum(totalQty)}</td>
                  <td className="text-right py-2 px-3 border text-orange-700">{fmt(totalPurchaseVal)}</td>
                  <td className="text-right py-2 px-3 border text-green-700">{fmt(totalSaleVal)}</td>
                  <td className="text-right py-2 px-3 border text-purple-700">{fmt(totalProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Product-wise list */}
      <div>
        <h3 className="font-semibold mb-2 text-sm">
          {filterType === "product" && selectedProduct !== "all"
            ? "Product Detail"
            : filterType === "all"
            ? `All Products by Category (${filtered.length})`
            : `All Products (${filtered.length})`}
        </h3>
        {isLoading
          ? <p className="text-muted-foreground text-sm text-center py-8">Loading...</p>
          : filtered.length === 0
          ? <p className="text-muted-foreground text-sm text-center py-8">No products found</p>
          : filterType === "all"
          ? (() => {
              // Group by category, sorted A-Z by category name
              const groups: Record<string, typeof filtered> = {};
              for (const p of filtered) {
                const key = p.categoryName ?? "Uncategorized";
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
              }
              const sortedCategories = Object.keys(groups).sort((a, b) => a.localeCompare(b));
              return (
                <div className="space-y-5">
                  {sortedCategories.map(catName => {
                    const catProducts = groups[catName].slice().sort((a, b) => a.name.localeCompare(b.name));
                    const catQty = catProducts.reduce((s, p) => s + (p.availableStock ?? p.stockQty), 0);
                    const catPVal = catProducts.reduce((s, p) => s + (p.availableStock ?? p.stockQty) * p.purchasePrice, 0);
                    const catSVal = catProducts.reduce((s, p) => s + (p.availableStock ?? p.stockQty) * p.salePrice, 0);
                    return (
                      <div key={catName}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="font-semibold text-sm text-teal-700">{catName}</h4>
                          <span className="text-xs text-muted-foreground">({catProducts.length} products · {fmtNum(catQty)} units · {fmt(catPVal)} invested)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-teal-50 dark:bg-teal-950/20">
                                <th className="text-left py-1.5 px-2 border text-xs">Product</th>
                                <th className="text-left py-1.5 px-2 border text-xs">Company</th>
                                <th className="text-right py-1.5 px-2 border text-xs">Stock</th>
                                <th className="text-right py-1.5 px-2 border text-xs">P.Rate</th>
                                <th className="text-right py-1.5 px-2 border text-xs">S.Rate</th>
                                <th className="text-right py-1.5 px-2 border text-xs">P.Value</th>
                                <th className="text-right py-1.5 px-2 border text-xs">S.Value</th>
                                <th className="text-right py-1.5 px-2 border text-xs">Profit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {catProducts.map(p => {
                                const qty = p.availableStock ?? p.stockQty;
                                const pVal = qty * p.purchasePrice;
                                const sVal = qty * p.salePrice;
                                return (
                                  <tr key={p.id} className="border-b hover:bg-muted/10">
                                    <td className="py-1.5 px-2 border">
                                      <div className="font-medium text-xs">{p.name}</div>
                                      <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                                    </td>
                                    <td className="py-1.5 px-2 border text-xs text-muted-foreground">{p.companyName ?? "—"}</td>
                                    <td className="text-right py-1.5 px-2 border">
                                      {p.stockStatus === "out"
                                        ? <Badge variant="destructive" className="text-xs">0</Badge>
                                        : p.stockStatus === "low"
                                        ? <Badge className="text-xs bg-yellow-500 text-white">{fmtNum(qty)}</Badge>
                                        : <Badge className="text-xs bg-green-600 text-white">{fmtNum(qty)}</Badge>}
                                    </td>
                                    <td className="text-right py-1.5 px-2 border text-xs">{fmt(p.purchasePrice)}</td>
                                    <td className="text-right py-1.5 px-2 border text-xs text-green-700">{fmt(p.salePrice)}</td>
                                    <td className="text-right py-1.5 px-2 border font-medium text-orange-700 text-xs">{fmt(pVal)}</td>
                                    <td className="text-right py-1.5 px-2 border font-medium text-green-700 text-xs">{fmt(sVal)}</td>
                                    <td className="text-right py-1.5 px-2 border font-medium text-purple-700 text-xs">{fmt(sVal - pVal)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-muted/20 font-bold text-xs">
                                <td colSpan={2} className="py-1.5 px-2 border">Subtotal</td>
                                <td className="text-right py-1.5 px-2 border">{fmtNum(catQty)}</td>
                                <td colSpan={2} className="border" />
                                <td className="text-right py-1.5 px-2 border text-orange-700">{fmt(catPVal)}</td>
                                <td className="text-right py-1.5 px-2 border text-green-700">{fmt(catSVal)}</td>
                                <td className="text-right py-1.5 px-2 border text-purple-700">{fmt(catSVal - catPVal)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  {/* Grand total row */}
                  <div className="border-t-2 pt-2 flex flex-wrap gap-4 text-sm font-semibold">
                    <span>Grand Total: {filtered.length} products · {fmtNum(totalQty)} units</span>
                    <span className="text-orange-700">Invested: {fmt(totalPurchaseVal)}</span>
                    <span className="text-green-700">Sale Value: {fmt(totalSaleVal)}</span>
                    <span className="text-purple-700">Exp. Profit: {fmt(totalProfit)}</span>
                  </div>
                </div>
              );
            })()
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left py-2 px-2 border text-xs">Product</th>
                    <th className="text-left py-2 px-2 border text-xs">Company</th>
                    <th className="text-right py-2 px-2 border text-xs">Stock</th>
                    <th className="text-right py-2 px-2 border text-xs">P.Rate</th>
                    <th className="text-right py-2 px-2 border text-xs">S.Rate</th>
                    <th className="text-right py-2 px-2 border text-xs">P.Value</th>
                    <th className="text-right py-2 px-2 border text-xs">S.Value</th>
                    <th className="text-right py-2 px-2 border text-xs">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const qty = p.availableStock ?? p.stockQty;
                    const pVal = qty * p.purchasePrice;
                    const sVal = qty * p.salePrice;
                    return (
                      <tr key={p.id} className="border-b hover:bg-muted/10">
                        <td className="py-2 px-2 border">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                        </td>
                        <td className="py-2 px-2 border text-xs text-muted-foreground">{p.companyName ?? "—"}</td>
                        <td className="text-right py-2 px-2 border">
                          {p.stockStatus === "out"
                            ? <Badge variant="destructive" className="text-xs">0</Badge>
                            : p.stockStatus === "low"
                            ? <Badge className="text-xs bg-yellow-500 text-white">{fmtNum(qty)}</Badge>
                            : <Badge className="text-xs bg-green-600 text-white">{fmtNum(qty)}</Badge>}
                        </td>
                        <td className="text-right py-2 px-2 border text-xs">{fmt(p.purchasePrice)}</td>
                        <td className="text-right py-2 px-2 border text-xs text-green-700">{fmt(p.salePrice)}</td>
                        <td className="text-right py-2 px-2 border font-medium text-orange-700">{fmt(pVal)}</td>
                        <td className="text-right py-2 px-2 border font-medium text-green-700">{fmt(sVal)}</td>
                        <td className="text-right py-2 px-2 border font-medium text-purple-700">{fmt(sVal - pVal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-bold text-sm">
                    <td colSpan={2} className="py-2 px-2 border">Total ({filtered.length} products)</td>
                    <td className="text-right py-2 px-2 border">{fmtNum(totalQty)}</td>
                    <td colSpan={2} className="border" />
                    <td className="text-right py-2 px-2 border text-orange-700">{fmt(totalPurchaseVal)}</td>
                    <td className="text-right py-2 px-2 border text-green-700">{fmt(totalSaleVal)}</td>
                    <td className="text-right py-2 px-2 border text-purple-700">{fmt(totalProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

// ─── Product Profit Tab ───────────────────────────────────────────────────────

type ProfitPeriod = "today" | "7days" | "weekly" | "monthly" | "yearly";

function getPeriodDates(period: ProfitPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  if (period === "today")  return { from: iso(now),                     to: iso(now), label: "Today" };
  if (period === "7days")  return { from: iso(subDays(now, 6)),         to: iso(now), label: "Last 7 Days" };
  if (period === "weekly") return { from: iso(startOfWeek(now, { weekStartsOn: 1 })), to: iso(endOfWeek(now, { weekStartsOn: 1 })), label: "This Week" };
  if (period === "monthly") return { from: iso(startOfMonth(now)),      to: iso(endOfMonth(now)),  label: "This Month" };
  return                          { from: iso(startOfYear(now)),        to: iso(endOfYear(now)),   label: "This Year" };
}

function ProductProfitTab() {
  const [period, setPeriod] = useState<ProfitPeriod>("monthly");
  const { from, to, label } = getPeriodDates(period);

  const { data: sales = [], isLoading } = useListProductSales({ dateFrom: from, dateTo: to });

  const totalRevenue = sales.reduce((s, r) => s + r.totalAmount, 0);
  const totalProfit  = sales.reduce((s, r) => s + r.totalProfit, 0);
  const totalQtySold = sales.reduce((s, r) => s + (r.items ?? []).reduce((q, i) => q + i.quantity, 0), 0);
  const avgProfit    = sales.length > 0 ? totalProfit / sales.length : 0;

  // Product-wise aggregation
  const productWise: Record<string, { name: string; code: string; qty: number; revenue: number; profit: number }> = {};
  for (const s of sales) {
    for (const item of s.items ?? []) {
      const key = item.productId.toString();
      if (!productWise[key]) productWise[key] = { name: item.productName ?? "", code: item.productCode ?? "", qty: 0, revenue: 0, profit: 0 };
      productWise[key].qty     += item.quantity;
      productWise[key].revenue += item.lineTotal;
      productWise[key].profit  += item.profit;
    }
  }
  const sorted = Object.values(productWise).sort((a, b) => b.profit - a.profit);

  const periods: { key: ProfitPeriod; label: string }[] = [
    { key: "today",   label: "Today"   },
    { key: "7days",   label: "7 Days"  },
    { key: "weekly",  label: "Weekly"  },
    { key: "monthly", label: "Monthly" },
    { key: "yearly",  label: "Yearly"  },
  ];

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {periods.map(p => (
          <Button
            key={p.key}
            size="sm"
            variant={period === p.key ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">{from} → {to}</span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50 text-center">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Total Sales</p>
          <p className="text-3xl font-bold text-blue-700">{sales.length}</p>
          <p className="text-xs text-blue-500 mt-0.5">{label}</p>
        </div>
        <div className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50 text-center">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Units Sold</p>
          <p className="text-3xl font-bold text-orange-700">{totalQtySold}</p>
          <p className="text-xs text-orange-500 mt-0.5">total items</p>
        </div>
        <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50 text-center">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Revenue</p>
          <p className="text-2xl font-bold text-green-700">{fmt(totalRevenue)}</p>
          <p className="text-xs text-green-500 mt-0.5">total collected</p>
        </div>
        <div className={`border-2 rounded-xl p-4 text-center ${totalProfit >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>Net Profit</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(totalProfit)}</p>
          <p className={`text-xs mt-0.5 ${totalProfit >= 0 ? "text-emerald-500" : "text-red-400"}`}>avg {fmt(avgProfit)}/sale</p>
        </div>
      </div>

      {/* Product breakdown */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No sales in {label.toLowerCase()}</p>
        </div>
      ) : (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product-wise Profit — {label} ({sorted.length} products)
          </h3>
          <div className="space-y-2">
            {sorted.map((p, i) => {
              const pct = totalProfit > 0 ? Math.round((p.profit / totalProfit) * 100) : 0;
              return (
                <div key={i} className="border rounded-xl p-4 bg-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.name}</span>
                        <Badge variant="outline" className="text-xs font-mono">{p.code}</Badge>
                        {i === 0 && <Badge className="text-xs bg-amber-100 text-amber-800">🏆 Top</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Sold: {p.qty} units</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{fmt(p.revenue)}</p>
                      <p className={`text-sm font-semibold ${p.profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                        Profit: {fmt(p.profit)}
                      </p>
                    </div>
                  </div>
                  {/* Profit bar */}
                  {totalProfit > 0 && (
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                  {totalProfit > 0 && <p className="text-xs text-muted-foreground mt-1">{pct}% of total profit</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductReports() {
  const salesOnly = new URLSearchParams(window.location.search).get("tab") === "sales";
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [billSaleId, setBillSaleId] = useState<number | null>(null);

  const { data: sales = [], isLoading } = useListProductSales({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const totalRevenue = sales.reduce((s, r) => s + r.totalAmount, 0);
  const totalProfit = sales.reduce((s, r) => s + r.totalProfit, 0);

  const dateWise: Record<string, ProductSale[]> = {};
  for (const s of sales) {
    const key = format(new Date(s.saleDate), "dd MMM yyyy");
    if (!dateWise[key]) dateWise[key] = [];
    dateWise[key].push(s);
  }

  const productWise: Record<string, { name: string; code: string; qty: number; revenue: number; profit: number }> = {};
  for (const s of sales) {
    for (const item of s.items ?? []) {
      const key = item.productId.toString();
      if (!productWise[key]) productWise[key] = { name: item.productName ?? "", code: item.productCode ?? "", qty: 0, revenue: 0, profit: 0 };
      productWise[key].qty += item.quantity;
      productWise[key].revenue += item.lineTotal;
      productWise[key].profit += item.profit;
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Product Reports</h1>
        <p className="text-muted-foreground text-sm">Sales, profit and stock value reports</p>
      </div>

      <Tabs defaultValue={salesOnly ? "sales" : "stock"}>
        {!salesOnly && (
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="stock" className="gap-1"><BarChart3 className="h-3.5 w-3.5" />Stock Value Report</TabsTrigger>
            <TabsTrigger value="sales"><ShoppingBag className="h-3.5 w-3.5 mr-1" />Product Sales</TabsTrigger>
            <TabsTrigger value="datewise">Date-wise</TabsTrigger>
            <TabsTrigger value="productwise"><TrendingUp className="h-3.5 w-3.5 mr-1" />Product Profit</TabsTrigger>
          </TabsList>
        )}

        {/* ── Stock Value Report ── */}
        {!salesOnly && (
          <TabsContent value="stock" className="mt-4">
            <StockValueReport />
          </TabsContent>
        )}

        {/* ── Sales Filters (shared for sales tabs) ── */}
        <TabsContent value="sales" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="border rounded-xl p-4 bg-card text-center">
                <p className="text-2xl font-bold text-blue-600">{sales.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Sales</p>
              </div>
              <div className="border rounded-xl p-4 bg-card text-center">
                <p className="text-2xl font-bold text-green-700">{fmt(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Revenue</p>
              </div>
              <div className="border rounded-xl p-4 bg-card text-center col-span-2 sm:col-span-1">
                <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(totalProfit)}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Profit</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Customer search..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              {(dateFrom || dateTo || search) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}>Clear</Button>
              )}
            </div>
            {isLoading ? <p className="text-muted-foreground text-sm text-center py-10">Loading...</p> : <SalesTable sales={sales} onViewBill={id => setBillSaleId(id)} />}
          </div>
        </TabsContent>

        {!salesOnly && <TabsContent value="datewise" className="mt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>}
          </div>
          {Object.keys(dateWise).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No sales found</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(dateWise).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime()).map(([date, daySales]) => {
                const dayRevenue = daySales.reduce((s, r) => s + r.totalAmount, 0);
                const dayProfit = daySales.reduce((s, r) => s + r.totalProfit, 0);
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between mb-2 pb-1 border-b">
                      <h3 className="font-semibold">{date}</h3>
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">Revenue: <strong>{fmt(dayRevenue)}</strong></span>
                        <span className={dayProfit >= 0 ? "text-green-700" : "text-red-600"}>Profit: <strong>{fmt(dayProfit)}</strong></span>
                      </div>
                    </div>
                    <SalesTable sales={daySales} onViewBill={id => setBillSaleId(id)} />
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>}

        {!salesOnly && <TabsContent value="productwise" className="mt-4">
          <ProductProfitTab />
        </TabsContent>}
      </Tabs>

      <BillModal saleId={billSaleId} open={!!billSaleId} onClose={() => setBillSaleId(null)} />
    </div>
  );
}
