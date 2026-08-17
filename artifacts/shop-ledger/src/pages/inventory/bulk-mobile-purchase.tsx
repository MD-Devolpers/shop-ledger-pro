import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  useBulkCreateMobilePurchases,
  type MobilePurchase,
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Save, ArrowLeft, Cpu, Printer, Download, CheckCircle2, Banknote, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MOBILE_BRANDS } from "./mobile-purchase";
import { format } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type Row = {
  _id: string;
  imei: string; imei2: string;
  mobileModel: string; company: string; color: string; storageCapacity: string;
  condition: string; purchasePrice: string; salePrice: string;
};

function newRow(): Row {
  return {
    _id: Math.random().toString(36).slice(2),
    imei: "", imei2: "",
    mobileModel: "", company: "", color: "", storageCapacity: "",
    condition: "used", purchasePrice: "", salePrice: "",
  };
}

// Total input columns (keyboard nav): imei, imei2, model, company, color, storage, buy, sale
const INPUT_COLS = 8;

// ─── Print Bill (all saved mobiles) ─────────────────────────────────────────────
function buildBillHTML(
  items: MobilePurchase[],
  sellerName: string,
  sellerPhone: string,
  purchaseDate: string,
): string {
  const total = items.reduce((s, m) => s + (m.purchasePrice || 0), 0);
  const rowsHtml = items.map((m, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(m.mobileModel)}</td>
      <td>${esc(m.company)}</td>
      <td style="font-family:monospace">${esc(m.imei || "—")}</td>
      <td>${esc([m.color, m.storageCapacity].filter(Boolean).join(" / ") || "—")}</td>
      <td style="text-align:right">${esc(fmt(m.purchasePrice || 0))}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Bill — ${esc(sellerName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
  .header{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:16px}
  .seller-name{font-size:22px;font-weight:bold}
  .seller-info{font-size:12px;color:#555;margin-top:4px}
  .bill-title{font-size:14px;font-weight:bold;text-align:center;margin:10px 0;text-transform:uppercase;letter-spacing:1px;color:#444}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th{background:#1a1a1a;color:#fff;text-align:left;padding:8px 6px;font-size:12px}
  td{padding:6px;border-bottom:1px solid #eee}
  tfoot td{font-weight:bold;border-top:2px solid #1a1a1a;font-size:14px}
  .footer{text-align:center;font-size:11px;color:#888;margin-top:20px;border-top:1px solid #eee;padding-top:12px}
  @media print{body{padding:10px}}
</style>
</head><body>
<div class="header">
  <div class="seller-name">Bill — ${esc(sellerName)}</div>
  <div class="seller-info">${sellerPhone ? "📞 " + esc(sellerPhone) : ""}${sellerPhone ? " | " : ""}${esc(format(new Date(purchaseDate), "dd MMM yyyy"))}</div>
</div>
<div class="bill-title">📱 Mobile Purchase Bill (${items.length} mobiles)</div>
<table>
  <thead>
    <tr>
      <th style="width:36px;text-align:center">#</th>
      <th>Model</th>
      <th>Company</th>
      <th>IMEI</th>
      <th>Color / Storage</th>
      <th style="text-align:right">Purchase Price</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot>
    <tr>
      <td colspan="5" style="text-align:right">Total</td>
      <td style="text-align:right">${esc(fmt(total))}</td>
    </tr>
  </tfoot>
</table>
<div class="footer">Printed: ${esc(format(new Date(), "dd MMM yyyy, h:mm a"))}</div>
</body></html>`;
}

function printBill(items: MobilePurchase[], sellerName: string, sellerPhone: string, purchaseDate: string) {
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  w.document.write(buildBillHTML(items, sellerName, sellerPhone, purchaseDate));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function BulkMobilePurchase() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const bulkCreate = useBulkCreateMobilePurchases();
  const tableRef = useRef<HTMLDivElement>(null);
  const billRef = useRef<HTMLDivElement>(null);

  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [purchaseSource, setPurchaseSource] = useState<"company" | "person">("company");
  const [isCredit, setIsCredit] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 10 }, newRow));

  // Bill dialog state (after save)
  const [billOpen, setBillOpen] = useState(false);
  const [savedItems, setSavedItems] = useState<MobilePurchase[]>([]);
  const [billSeller, setBillSeller] = useState({ name: "", phone: "", date: purchaseDate });

  const addRow = () => setRows(r => [...r, newRow()]);
  const removeRow = (id: string) => setRows(r => r.length > 1 ? r.filter(x => x._id !== id) : r);

  const updateRow = useCallback((id: string, field: keyof Omit<Row, "_id">, value: string) => {
    setRows(rows => rows.map(r => r._id === id ? { ...r, [field]: value } : r));
  }, []);

  const validRows = rows.filter(r => r.mobileModel.trim() && r.company.trim());
  const totalInvestment = validRows.reduce((s, r) => s + (parseFloat(r.purchasePrice) || 0), 0);
  const totalSale = validRows.reduce((s, r) => s + (parseFloat(r.salePrice) || 0), 0);
  const totalProfit = totalSale - totalInvestment;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < INPUT_COLS) {
        tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${rowIdx}-${nextCol}"]`)?.focus();
      } else {
        const nextRow = rowIdx + 1;
        if (nextRow >= rows.length) addRow();
        setTimeout(() => {
          tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${nextRow}-0"]`)?.focus();
        }, 50);
      }
    }
  }

  async function handleSave() {
    if (!sellerName.trim()) {
      toast({ title: "Seller Name required", description: "Enter the seller name at the top", variant: "destructive" }); return;
    }
    if (validRows.length === 0) {
      toast({ title: "No valid rows", description: "Model and Company required", variant: "destructive" }); return;
    }
    try {
      const result = await bulkCreate.mutateAsync({
        purchaseDate,
        isCredit,
        items: validRows.map(r => ({
          sellerName: sellerName.trim(),
          sellerPhone: sellerPhone.trim() || null,
          sellerAddress: sellerAddress.trim() || null,
          purchaseSource,
          imei: r.imei || null,
          imei2: r.imei2 || null,
          mobileModel: r.mobileModel.trim(),
          company: r.company.trim(),
          color: r.color || null,
          storageCapacity: r.storageCapacity || null,
          condition: r.condition,
          purchasePrice: parseFloat(r.purchasePrice) || 0,
          salePrice: parseFloat(r.salePrice) || 0,
          notes: notes || null,
          purchaseDate,
        })),
      });
      toast({
        title: `✅ ${result.count} mobiles saved!`,
        description: `Total investment: ${fmt(totalInvestment)}`,
      });

      // Open bill dialog with saved items
      setSavedItems(result.items ?? []);
      setBillSeller({ name: sellerName.trim(), phone: sellerPhone.trim(), date: purchaseDate });
      setBillOpen(true);

      // Reset form
      setRows(Array.from({ length: 10 }, newRow));
      setPurchaseDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
      setSellerName("");
      setSellerPhone("");
      setSellerAddress("");
      setPurchaseSource("company");
      setIsCredit(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    }
  }

  async function handleDownloadPDF() {
    if (!billRef.current || savedItems.length === 0) return;
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    const canvas = await html2canvas(billRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
    pdf.save(`MobileBill-${(billSeller.name || "seller").replace(/\s+/g, "_")}.pdf`);
  }

  const billTotal = savedItems.reduce((s, m) => s + (m.purchasePrice || 0), 0);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/inventory/mobile-purchase")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Cpu className="h-4 w-4 text-violet-600" />
        <h1 className="font-bold text-base">Bulk Mobile Purchase</h1>
        <span className="text-muted-foreground text-xs hidden sm:inline">· Enter multiple mobiles at once</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/inventory/mobile-purchase")}>
            <Cpu className="h-3.5 w-3.5 mr-1" />Mobile List
          </Button>
        </div>
      </div>

      {/* ── Seller / Source card (top, once) ── */}
      <div className="px-3 py-3 border-b bg-muted/20 shrink-0">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "180px" }}>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Seller Name *</label>
              <Input className="h-8 text-sm" placeholder="Seller name..." value={sellerName} onChange={e => setSellerName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1" style={{ width: "150px" }}>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Contact Number</label>
              <Input className="h-8 text-sm" placeholder="03xx..." value={sellerPhone} onChange={e => setSellerPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "180px" }}>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Address (optional)</label>
              <Input className="h-8 text-sm" placeholder="Address..." value={sellerAddress} onChange={e => setSellerAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Purchase Date</label>
              <Input type="date" className="h-8 w-40 text-sm" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end mt-3">
            <div className="flex flex-col gap-1" style={{ minWidth: "220px" }}>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Source</label>
              <Select value={purchaseSource} onValueChange={v => setPurchaseSource(v as "company" | "person")}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company / Supplier</SelectItem>
                  <SelectItem value="person">Seller / Person's phone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1" style={{ minWidth: "220px" }}>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Payment</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setIsCredit(false)}
                  className={`h-8 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${!isCredit ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:border-emerald-300 text-muted-foreground"}`}>
                  <Banknote className="h-3.5 w-3.5" />Cash
                </button>
                <button type="button" onClick={() => setIsCredit(true)}
                  className={`h-8 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${isCredit ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:border-blue-300 text-muted-foreground"}`}>
                  <ClipboardList className="h-3.5 w-3.5" />Credit
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: "220px" }}>
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Common Notes (all rows)</label>
              <Input className="h-8 text-sm" placeholder="Optional note for all mobiles..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          {isCredit && (
            <p className="text-[11px] text-blue-700 mt-2">
              🧾 Credit purchase — a payable credit for {sellerName || "the seller"} ({fmt(totalInvestment)}) will be added in Credits after saving.
            </p>
          )}
          <p className="text-[11px] text-amber-700 mt-2">
            💡 Person-source profit appears only in the Mobile Purchase report (not in overall profits). Company/Supplier profit is counted in overall profits.
          </p>
        </div>
      </div>

      {/* ── Header bar (totals + save) ── */}
      <div className="flex flex-wrap gap-2 px-3 py-2 border-b bg-muted/20 shrink-0 items-end">
        <div className="flex items-end gap-3 ml-auto">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mobiles · Investment · Est. Profit</p>
            <p className="text-sm font-bold">
              <span className="text-violet-700">{validRows.length}</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-red-600">{fmt(totalInvestment)}</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className={totalProfit >= 0 ? "text-green-700" : "text-red-600"}>{fmt(totalProfit)}</span>
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={bulkCreate.isPending || validRows.length === 0}
            className="h-8 text-white bg-violet-600 hover:bg-violet-700"
            size="sm"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {bulkCreate.isPending ? "Saving..." : `Save ${validRows.length > 0 ? `(${validRows.length})` : "All"}`}
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="w-full text-sm border-collapse" style={{ minWidth: "1100px" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 text-white text-xs">
              <th className="py-2 px-2 text-center font-medium w-8 border-r border-slate-700">#</th>
              {/* Mobile */}
              <th className="py-2 px-2 text-left font-medium w-[140px] border-r border-slate-700">IMEI 1</th>
              <th className="py-2 px-2 text-left font-medium w-[140px] border-r border-slate-700">IMEI 2</th>
              <th className="py-2 px-2 text-left font-medium border-r border-slate-700" style={{ minWidth: "150px" }}>Model *</th>
              <th className="py-2 px-2 text-left font-medium w-[140px] border-r border-slate-700">Company *</th>
              <th className="py-2 px-2 text-left font-medium w-[90px] border-r border-slate-700">Color</th>
              <th className="py-2 px-2 text-left font-medium w-[90px] border-r border-slate-700">Storage</th>
              <th className="py-2 px-2 text-center font-medium w-[110px] border-r border-slate-700">Condition</th>
              {/* Prices */}
              <th className="py-2 px-2 text-right font-medium w-[110px] border-r border-slate-700">Buy Price</th>
              <th className="py-2 px-2 text-right font-medium w-[110px] border-r border-slate-700">Sale Price</th>
              <th className="py-2 px-2 text-right font-medium w-[100px] border-r border-slate-700">Profit</th>
              <th className="py-2 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const buyPrice = parseFloat(row.purchasePrice || "0");
              const salePrice = parseFloat(row.salePrice || "0");
              const profit = salePrice - buyPrice;
              const isValid = row.mobileModel.trim() && row.company.trim();
              const bg = isValid ? "bg-white" : idx % 2 === 0 ? "bg-gray-50" : "bg-white";

              const inp = (col: number, field: keyof Omit<Row, "_id">, placeholder: string, extra?: any) => (
                <input
                  data-cell={`${idx}-${col}`}
                  className={`w-full h-8 px-2 text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 rounded ${extra?.mono ? "font-mono" : ""} ${extra?.right ? "text-right" : ""}`}
                  placeholder={placeholder}
                  value={row[field] as string}
                  onChange={e => updateRow(row._id, field, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, idx, col)}
                  type={extra?.type ?? "text"}
                  min={extra?.min}
                />
              );

              return (
                <tr key={row._id} className={`border-b ${bg} hover:bg-violet-50/30 transition-colors`}>
                  {/* # */}
                  <td className="py-0.5 px-2 text-center text-xs text-muted-foreground font-medium border-r">{idx + 1}</td>

                  {/* IMEI 1 */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(0, "imei", "IMEI 1...", { mono: true })}
                  </td>

                  {/* IMEI 2 */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(1, "imei2", "IMEI 2...", { mono: true })}
                  </td>

                  {/* Model */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(2, "mobileModel", "e.g. iPhone 15...")}
                  </td>

                  {/* Company */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-3`}
                      className="w-full h-8 px-2 text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 rounded"
                      placeholder="Apple, Samsung..."
                      value={row.company}
                      onChange={e => updateRow(row._id, "company", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 3)}
                      list="bulk-companies"
                    />
                  </td>

                  {/* Color */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(4, "color", "Black...")}
                  </td>

                  {/* Storage */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(5, "storageCapacity", "128GB...")}
                  </td>

                  {/* Condition */}
                  <td className="py-0.5 px-1 border-r">
                    <Select value={row.condition} onValueChange={v => updateRow(row._id, "condition", v)}>
                      <SelectTrigger className="h-8 w-full text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-violet-400 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                        <SelectItem value="refurbished">Refurbished</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Buy Price */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(6, "purchasePrice", "0", { type: "number", min: "0", right: true })}
                  </td>

                  {/* Sale Price */}
                  <td className="py-0.5 px-1 border-r">
                    {inp(7, "salePrice", "0", { type: "number", min: "0", right: true })}
                  </td>

                  {/* Profit */}
                  <td className="py-0.5 px-2 text-right border-r">
                    {buyPrice > 0 || salePrice > 0
                      ? <span className={`text-xs font-semibold ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {profit >= 0 ? "+" : ""}{fmt(profit)}
                        </span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>

                  {/* Delete */}
                  <td className="py-0.5 px-1 text-center">
                    <button
                      onClick={() => removeRow(row._id)}
                      className="h-7 w-7 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 flex items-center justify-center mx-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Add row */}
            <tr className="bg-muted/5 border-b">
              <td colSpan={12} className="py-2 px-3">
                <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-violet-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" />Add Row
                </button>
              </td>
            </tr>

            {/* Totals */}
            {validRows.length > 0 && (
              <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300 sticky bottom-0">
                <td colSpan={8} className="py-2 px-3 text-xs text-muted-foreground border-r">
                  {validRows.length} mobile{validRows.length !== 1 ? "s" : ""} · {format(new Date(purchaseDate), "dd MMM yyyy")}
                </td>
                <td className="py-2 px-2 text-right text-sm text-red-600 border-r">{fmt(totalInvestment)}</td>
                <td className="py-2 px-2 text-right text-sm text-blue-700 border-r">{fmt(totalSale)}</td>
                <td className="py-2 px-2 text-right text-sm border-r">
                  <span className={totalProfit >= 0 ? "text-green-700" : "text-red-600"}>{fmt(totalProfit)}</span>
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>

        {/* Shared datalist of mobile brands (free text still allowed for new companies) */}
        <datalist id="bulk-companies">
          {MOBILE_BRANDS.map(b => <option key={b} value={b} />)}
        </datalist>
      </div>

      {/* ── Bottom status bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/10 text-xs text-muted-foreground shrink-0">
        <span>{rows.length} rows · {validRows.length} valid · Enter/Tab = next cell</span>
        <div className="flex items-center gap-3">
          <span>Buy: <strong className="text-red-600">{fmt(totalInvestment)}</strong></span>
          <span>Profit: <strong className={totalProfit >= 0 ? "text-green-700" : "text-red-600"}>{fmt(totalProfit)}</strong></span>
          <Button
            onClick={handleSave}
            disabled={bulkCreate.isPending || validRows.length === 0}
            className="h-7 bg-violet-600 hover:bg-violet-700 text-white text-xs px-4"
            size="sm"
          >
            {bulkCreate.isPending ? "Saving..." : "Save (Enter)"}
          </Button>
        </div>
      </div>

      {/* ── Success / Bill dialog ── */}
      <Dialog open={billOpen} onOpenChange={setBillOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {savedItems.length} Mobiles Saved
            </DialogTitle>
          </DialogHeader>

          {/* Printable bill preview */}
          <div ref={billRef} className="bg-white p-4 rounded-lg border text-sm">
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-3">
              <div className="text-lg font-bold">Bill — {billSeller.name || "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {billSeller.phone ? `📞 ${billSeller.phone} | ` : ""}{format(new Date(billSeller.date), "dd MMM yyyy")}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-teal-50 text-teal-900">
                    <th className="py-2 px-2 text-center font-semibold border-b w-8">#</th>
                    <th className="py-2 px-2 text-left font-semibold border-b">Model</th>
                    <th className="py-2 px-2 text-left font-semibold border-b">Company</th>
                    <th className="py-2 px-2 text-left font-semibold border-b">IMEI</th>
                    <th className="py-2 px-2 text-left font-semibold border-b">Color / Storage</th>
                    <th className="py-2 px-2 text-right font-semibold border-b">Purchase Price</th>
                  </tr>
                </thead>
                <tbody>
                  {savedItems.map((m, i) => (
                    <tr key={m.id} className="border-b">
                      <td className="py-1.5 px-2 text-center text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 px-2 font-medium">{m.mobileModel}</td>
                      <td className="py-1.5 px-2">{m.company}</td>
                      <td className="py-1.5 px-2 font-mono">{m.imei || "—"}</td>
                      <td className="py-1.5 px-2">{[m.color, m.storageCapacity].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(m.purchasePrice || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-800 font-bold">
                    <td colSpan={5} className="py-2 px-2 text-right">Total</td>
                    <td className="py-2 px-2 text-right">{fmt(billTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setBillOpen(false)}>Close</Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-1" />Download PDF
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => printBill(savedItems, billSeller.name, billSeller.phone, billSeller.date)}
            >
              <Printer className="h-4 w-4 mr-1" />Print Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
