import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListPurchaseBills, useGetPurchaseBill, useDeletePurchaseBill,
  useListCompanies, useListProducts, useUploadBillAttachment, useDeleteBillAttachment,
  type PurchaseBill,
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Eye, Trash2, Receipt, Search, ClipboardList, PackagePlus,
  Calendar, Building2, Package, Paperclip, Upload, X, FileText, Image, Printer, Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// ─── Bill Detail Dialog ────────────────────────────────────────────────────────
function BillDetailDialog({ billId, open, onClose }: { billId: number | null; open: boolean; onClose: () => void }) {
  const { data: bill } = useGetPurchaseBill(billId);
  if (!bill) return null;

  const grandTotal = bill.items?.reduce((s, i) => s + i.totalAmount, 0) ?? bill.totalAmount;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-teal-600" />
            Purchase Bill #{bill.billNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Bill header info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Supplier</p>
              <p className="font-semibold">{bill.supplierName}</p>
            </div>
            {bill.companyName && (
              <div>
                <p className="text-muted-foreground text-xs">Company</p>
                <p className="font-semibold">{bill.companyName}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-xs">Bill Date</p>
              <p className="font-semibold">{format(new Date(bill.billDate), "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Amount</p>
              <p className="font-bold text-blue-700 text-base">{fmt(grandTotal)}</p>
            </div>
          </div>
          {bill.notes && (
            <p className="text-xs text-muted-foreground italic px-1">📝 {bill.notes}</p>
          )}

          {/* Items table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40">
                  <th className="text-left py-2.5 px-3 border-b font-semibold">#</th>
                  <th className="text-left py-2.5 px-3 border-b font-semibold">Product</th>
                  <th className="text-right py-2.5 px-3 border-b font-semibold">Qty</th>
                  <th className="text-right py-2.5 px-3 border-b font-semibold">Purchase Rate</th>
                  <th className="text-right py-2.5 px-3 border-b font-semibold">Sale Rate</th>
                  <th className="text-right py-2.5 px-3 border-b font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items?.map((item, idx) => (
                  <tr key={item.id} className="border-b hover:bg-muted/10">
                    <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{item.productName}</div>
                      {item.productCode && (
                        <div className="text-muted-foreground font-mono">{item.productCode}</div>
                      )}
                    </td>
                    <td className="text-right py-2 px-3 font-semibold">{item.quantity}</td>
                    <td className="text-right py-2 px-3 text-orange-700">{fmt(item.purchaseRate)}</td>
                    <td className="text-right py-2 px-3 text-green-700">
                      {item.saleRate > 0 ? fmt(item.saleRate) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="text-right py-2 px-3 font-bold text-blue-700">{fmt(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20">
                  <td colSpan={5} className="text-right py-2.5 px-3 font-semibold text-sm">Grand Total</td>
                  <td className="text-right py-2.5 px-3 font-bold text-blue-700 text-sm">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {(!bill.items || bill.items.length === 0) && (
            <p className="text-center text-muted-foreground text-sm py-6">No items found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Print Bill Dialog ─────────────────────────────────────────────────────────
function PrintBillDialog({ billId, open, onClose }: { billId: number | null; open: boolean; onClose: () => void }) {
  const { data: bill } = useGetPurchaseBill(billId);
  const previewRef = useRef<HTMLDivElement>(null);

  async function handleDownloadPDF() {
    if (!previewRef.current || !bill) return;
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    const canvas = await html2canvas(previewRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
    pdf.save(`PurchaseBill-${bill.billNumber}.pdf`);
  }

  if (!bill) return null;

  const items = bill.items ?? [];
  const grandTotal = items.reduce((s, i) => s + i.totalAmount, 0) || bill.totalAmount;
  const grandSaleTotal = items.reduce((s, i) => s + i.quantity * i.saleRate, 0);

  // Group items by company for mixed-company bills
  const companyGroups: Record<string, typeof items> = {};
  for (const item of items) {
    const key = item.companyName ?? bill.companyName ?? "—";
    if (!companyGroups[key]) companyGroups[key] = [];
    companyGroups[key].push(item);
  }
  const isMixedCompany = Object.keys(companyGroups).length > 1;
  const companiesInBill = Object.keys(companyGroups);

  const buildItemRows = (subset: typeof items, startIdx = 0) =>
    subset.map((item, i) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 10px;text-align:center;color:#6b7280;">${startIdx + i + 1}</td>
        <td style="padding:6px 10px;">
          <div style="font-weight:600;">${esc(item.productName)}</div>
          ${item.productCode ? `<div style="font-size:11px;color:#9ca3af;font-family:monospace;">${esc(item.productCode)}</div>` : ""}
        </td>
        <td style="padding:6px 10px;text-align:right;font-weight:700;">${item.quantity}</td>
        <td style="padding:6px 10px;text-align:right;color:#92400e;">${fmt(item.purchaseRate)}</td>
        <td style="padding:6px 10px;text-align:right;color:#065f46;">${item.saleRate > 0 ? fmt(item.saleRate) : "—"}</td>
        <td style="padding:6px 10px;text-align:right;font-weight:700;color:#1d4ed8;">${fmt(item.totalAmount)}</td>
      </tr>`).join("");

  const buildCompanySections = () => {
    if (!isMixedCompany) return buildItemRows(items);
    let html = "";
    let globalIdx = 0;
    for (const [co, coItems] of Object.entries(companyGroups)) {
      const coTotal = coItems.reduce((s, i) => s + i.totalAmount, 0);
      html += `<tr style="background:#f0fdf4;"><td colspan="6" style="padding:6px 10px;font-weight:700;color:#065f46;font-size:12px;">📦 ${esc(co)} — ${fmt(coTotal)}</td></tr>`;
      html += buildItemRows(coItems, globalIdx);
      globalIdx += coItems.length;
    }
    return html;
  };

  const handlePrint = () => {
    const printWin = window.open("", "_blank", "width=800,height=600");
    if (!printWin) return;
    printWin.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>Purchase Bill #${esc(bill.billNumber)}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 20px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:14px; border-bottom:2px solid #0d9488; }
        .shop-name { font-size:22px; font-weight:800; color:#0d9488; }
        .bill-title { font-size:13px; color:#6b7280; margin-top:2px; }
        .bill-meta { text-align:right; font-size:12px; }
        .bill-no { font-size:18px; font-weight:700; color:#111; }
        .info-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:18px; }
        .info-label { font-size:10px; color:#9ca3af; text-transform:uppercase; letter-spacing:.05em; margin-bottom:2px; }
        .info-value { font-weight:600; font-size:13px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        thead tr { background:#1e293b; color:#fff; }
        thead th { padding:8px 10px; text-align:left; font-weight:600; font-size:11px; }
        thead th:nth-child(n+3) { text-align:right; }
        tfoot tr { background:#f0fdf4; }
        tfoot td { padding:8px 10px; font-weight:700; font-size:13px; }
        .footer { margin-top:20px; text-align:center; font-size:10px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:10px; }
        @media print { body { padding:10px; } }
      </style>
      </head><body>
      <div class="header">
        <div>
          <div class="shop-name">Shop Ledger</div>
          <div class="bill-title">Purchase Bill</div>
        </div>
        <div class="bill-meta">
          <div class="bill-no">#${esc(bill.billNumber)}</div>
          <div style="color:#6b7280;margin-top:4px;">${format(new Date(bill.billDate), "dd MMM yyyy")}</div>
        </div>
      </div>
      <div class="info-grid">
        <div><div class="info-label">Supplier</div><div class="info-value">${esc(bill.supplierName)}</div></div>
        <div><div class="info-label">${isMixedCompany ? "Companies" : "Company"}</div><div class="info-value">${esc(isMixedCompany ? companiesInBill.join(", ") : (bill.companyName ?? "—"))}</div></div>
        <div><div class="info-label">Purchase Total</div><div class="info-value" style="color:#1d4ed8;font-size:15px;">${fmt(grandTotal)}</div></div>
        ${grandSaleTotal > 0 ? `<div><div class="info-label">Sale Value</div><div class="info-value" style="color:#065f46;">${fmt(grandSaleTotal)}</div></div>` : ""}
        ${bill.notes ? `<div style="grid-column:1/-1"><div class="info-label">Notes</div><div class="info-value" style="font-style:italic;font-weight:400;">${esc(bill.notes)}</div></div>` : ""}
      </div>
      <table>
        <thead><tr>
          <th style="width:36px;">#</th>
          <th>Product</th>
          <th style="text-align:right;width:60px;">Qty</th>
          <th style="text-align:right;width:110px;">Purchase Rate</th>
          <th style="text-align:right;width:110px;">Sale Rate</th>
          <th style="text-align:right;width:110px;">Total</th>
        </tr></thead>
        <tbody>${buildCompanySections()}</tbody>
        <tfoot>
          <tr><td colspan="5" style="text-align:right;color:#6b7280;">Purchase Total</td><td style="text-align:right;color:#1d4ed8;">${fmt(grandTotal)}</td></tr>
          ${grandSaleTotal > 0 ? `<tr><td colspan="5" style="text-align:right;color:#6b7280;">Sale Value</td><td style="text-align:right;color:#065f46;">${fmt(grandSaleTotal)}</td></tr>` : ""}
        </tfoot>
      </table>
      <div class="footer">Generated by Shop Ledger Pro · ${format(new Date(), "dd MMM yyyy HH:mm")}</div>
      </body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 400);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-teal-600" />
            Bill #{bill.billNumber} — Preview
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div ref={previewRef} className="border rounded-lg overflow-hidden text-sm">
          {/* Bill header */}
          <div className="flex items-start justify-between p-4 bg-slate-800 text-white">
            <div>
              <p className="text-lg font-bold text-teal-300">Shop Ledger</p>
              <p className="text-xs text-slate-400 mt-0.5">Purchase Bill</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">#{bill.billNumber}</p>
              <p className="text-xs text-slate-400 mt-0.5">{format(new Date(bill.billDate), "dd MMM yyyy")}</p>
            </div>
          </div>

          {/* Info bar */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 border-b text-xs">
            <div>
              <p className="text-muted-foreground">Supplier</p>
              <p className="font-semibold">{bill.supplierName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{isMixedCompany ? "Companies" : "Company"}</p>
              <p className="font-semibold">{isMixedCompany ? companiesInBill.join(", ") : (bill.companyName ?? "—")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Purchase Total</p>
              <p className="font-bold text-blue-700 text-base">{fmt(grandTotal)}</p>
            </div>
            {grandSaleTotal > 0 && (
              <div>
                <p className="text-muted-foreground">Sale Value</p>
                <p className="font-semibold text-green-700">{fmt(grandSaleTotal)}</p>
              </div>
            )}
            {bill.notes && (
              <div className="col-span-3">
                <p className="text-muted-foreground">Notes</p>
                <p className="italic">{bill.notes}</p>
              </div>
            )}
          </div>

          {/* Items — grouped by company if mixed */}
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-muted/40">
                <th className="py-2 px-3 text-center font-semibold border-b w-8">#</th>
                <th className="py-2 px-3 text-left font-semibold border-b">Product</th>
                <th className="py-2 px-3 text-right font-semibold border-b w-14">Qty</th>
                <th className="py-2 px-3 text-right font-semibold border-b w-24">Purchase Rate</th>
                <th className="py-2 px-3 text-right font-semibold border-b w-24">Sale Rate</th>
                <th className="py-2 px-3 text-right font-semibold border-b w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {isMixedCompany
                ? Object.entries(companyGroups).map(([co, coItems]) => {
                    const coTotal = coItems.reduce((s, i) => s + i.totalAmount, 0);
                    return (
                      <>
                        <tr key={`hdr-${co}`} className="bg-green-50 dark:bg-green-950/20">
                          <td colSpan={6} className="py-1.5 px-3 font-semibold text-green-700 text-xs">
                            📦 {co} — {fmt(coTotal)}
                          </td>
                        </tr>
                        {coItems.map((item, idx) => (
                          <tr key={item.id} className="border-b hover:bg-muted/10">
                            <td className="py-1.5 px-3 text-center text-muted-foreground">{idx + 1}</td>
                            <td className="py-1.5 px-3">
                              <div className="font-medium">{item.productName}</div>
                              {item.productCode && <div className="text-muted-foreground font-mono">{item.productCode}</div>}
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold">{item.quantity}</td>
                            <td className="py-1.5 px-3 text-right text-orange-700">{fmt(item.purchaseRate)}</td>
                            <td className="py-1.5 px-3 text-right text-green-700">
                              {item.saleRate > 0 ? fmt(item.saleRate) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-blue-700">{fmt(item.totalAmount)}</td>
                          </tr>
                        ))}
                      </>
                    );
                  })
                : items.map((item, idx) => (
                    <tr key={item.id} className="border-b hover:bg-muted/10">
                      <td className="py-1.5 px-3 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="py-1.5 px-3">
                        <div className="font-medium">{item.productName}</div>
                        {item.productCode && <div className="text-muted-foreground font-mono">{item.productCode}</div>}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold">{item.quantity}</td>
                      <td className="py-1.5 px-3 text-right text-orange-700">{fmt(item.purchaseRate)}</td>
                      <td className="py-1.5 px-3 text-right text-green-700">
                        {item.saleRate > 0 ? fmt(item.saleRate) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right font-bold text-blue-700">{fmt(item.totalAmount)}</td>
                    </tr>
                  ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/20 font-bold">
                <td colSpan={5} className="py-2 px-3 text-right text-sm">Purchase Total</td>
                <td className="py-2 px-3 text-right text-blue-700 text-sm">{fmt(grandTotal)}</td>
              </tr>
              {grandSaleTotal > 0 && (
                <tr className="bg-green-50 dark:bg-green-950/20 font-semibold">
                  <td colSpan={5} className="py-2 px-3 text-right text-sm">Sale Value</td>
                  <td className="py-2 px-3 text-right text-green-700 text-sm">{fmt(grandSaleTotal)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:flex sm:justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" onClick={handleDownloadPDF} className="border-blue-300 text-blue-700 hover:bg-blue-50">
            <Download className="h-4 w-4 mr-1.5" />Download PDF
          </Button>
          <Button onClick={handlePrint} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Printer className="h-4 w-4 mr-1.5" />Print Bill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Purchase Report Page ─────────────────────────────────────────────────
export default function PurchaseBills() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const deleteBill = useDeletePurchaseBill();

  const { data: companies = [] } = useListCompanies();
  const { data: products = [] } = useListProducts();

  // Filters
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "date" | "company" | "bill">("none");

  const { data: bills = [], isLoading } = useListPurchaseBills({
    search: search || undefined,
    companyId: companyId ? parseInt(companyId) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    productId: filterProductId ? parseInt(filterProductId) : undefined,
  });

  const [viewBillId, setViewBillId] = useState<number | null>(null);
  const [printBillId, setPrintBillId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // bills are already server-filtered — no client-side transform needed
  const filteredBills = bills;

  // Group bills
  const grouped = (() => {
    const src = filteredBills;
    if (groupBy === "none") return { "All Bills": src };
    const map: Record<string, typeof src> = {};
    src.forEach(b => {
      let key = "";
      if (groupBy === "date") key = format(new Date(b.billDate), "dd MMM yyyy");
      else if (groupBy === "company") key = b.companyName ?? b.supplierName;
      else if (groupBy === "bill") key = `Bill #${b.billNumber}`;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  })();

  const totalBills = bills.length;
  const totalValue = bills.reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="p-4 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-600" />
            Purchase Report
          </h1>
          <p className="text-sm text-muted-foreground">Purchase bills and product stock history</p>
        </div>
        <Button
          onClick={() => navigate("/inventory/bulk-purchase")}
          className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white"
          size="sm"
        >
          <PackagePlus className="h-3.5 w-3.5 mr-1" />
          New Purchase
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="border rounded-xl p-3 bg-card text-center">
          <p className="text-xs text-muted-foreground">Total Bills</p>
          <p className="text-2xl font-bold">{totalBills}</p>
        </div>
        <div className="border rounded-xl p-3 bg-blue-50 text-center">
          <p className="text-xs text-blue-700">Total Purchased</p>
          <p className="text-xl font-bold text-blue-700">{fmt(totalValue)}</p>
        </div>
        <div className="border rounded-xl p-3 bg-card text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Filtered Results</p>
          <p className="text-2xl font-bold">{filteredBills.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Bill no, supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Company */}
          <Select value={companyId || "all"} onValueChange={v => setCompanyId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm">
              <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Product filter */}
          <Select value={filterProductId || "all"} onValueChange={v => setFilterProductId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm">
              <Package className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}{p.code ? ` (${p.code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Date From */}
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="date" className="pl-8 h-9 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          {/* Date To */}
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="date" className="pl-8 h-9 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* Group-by row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Group by:</span>
          {(["none", "date", "company", "bill"] as const).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                groupBy === g
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-card text-muted-foreground border hover:border-teal-400"
              }`}
            >
              {g === "none" ? "None" : g === "date" ? "Date-wise" : g === "company" ? "Company-wise" : "Bill No"}
            </button>
          ))}
          {(search || companyId || filterProductId || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setCompanyId(""); setFilterProductId(""); setDateFrom(""); setDateTo(""); }}
              className="px-3 py-1 rounded-full text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Bills List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filteredBills.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-card">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-medium text-muted-foreground">No bills found</p>
          <p className="text-sm text-muted-foreground mt-1">Change filters or add a new purchase</p>
          <Button
            size="sm"
            className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => navigate("/inventory/bulk-purchase")}
          >
            <PackagePlus className="h-3.5 w-3.5 mr-1" />
            New Bulk Purchase
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => {
            if (groupBy === "date") {
              try { return new Date(b).getTime() - new Date(a).getTime(); } catch { return 0; }
            }
            return a.localeCompare(b);
          }).map(([group, groupBills]) => (
            <div key={group}>
              {groupBy !== "none" && (
                <div className="flex items-center justify-between pb-2 mb-3 border-b">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    {groupBy === "date" && <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                    {groupBy === "company" && <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
                    {groupBy === "bill" && <Receipt className="h-3.5 w-3.5 text-muted-foreground" />}
                    {group}
                  </h3>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{groupBills.length} bills</span>
                    <span className="font-semibold text-blue-700">{fmt(groupBills.reduce((s, b) => s + b.totalAmount, 0))}</span>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-teal-50 dark:bg-teal-950/20">
                      <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
                      <th className="text-left py-2 px-2 border-b text-xs">Bill No</th>
                      <th className="text-left py-2 px-2 border-b text-xs">Supplier / Company</th>
                      <th className="text-left py-2 px-2 border-b text-xs">Date</th>
                      <th className="text-right py-2 px-2 border-b text-xs">Total</th>
                      <th className="text-right py-2 px-2 border-b text-xs">Paid</th>
                      <th className="text-right py-2 px-2 border-b text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupBills.map((b, idx) => (
                      <tr key={b.id} className="border-b last:border-b-0 hover:bg-muted/20">
                        <td className="text-center py-2 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="font-mono text-xs">#{b.billNumber}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-medium">{b.supplierName}</div>
                          {b.companyName && b.companyName !== b.supplierName && (
                            <div className="text-xs text-muted-foreground">{b.companyName}</div>
                          )}
                          {b.notes && <div className="text-xs text-muted-foreground italic truncate max-w-[220px]">"{b.notes}"</div>}
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(b.billDate), "dd MMM yyyy")}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 font-bold text-blue-700 whitespace-nowrap">{fmt(b.totalAmount)}</td>
                        <td className="text-right py-2 px-2 whitespace-nowrap">
                          <span className={b.paidAmount >= b.totalAmount ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                            {fmt(b.paidAmount)}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewBillId(b.id)}
                              className="h-7 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPrintBillId(b.id)}
                              className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50"
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Bill
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmDelete(b.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete !== null && (
        <Dialog open onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Bill?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Deleting this bill will remove the record. Stock will not be reversed.</p>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteBill.mutate(confirmDelete!, {
                    onSuccess: () => { toast({ title: "Bill deleted" }); setConfirmDelete(null); },
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <BillDetailDialog billId={viewBillId} open={!!viewBillId} onClose={() => setViewBillId(null)} />
      <PrintBillDialog billId={printBillId} open={!!printBillId} onClose={() => setPrintBillId(null)} />
    </div>
  );
}
