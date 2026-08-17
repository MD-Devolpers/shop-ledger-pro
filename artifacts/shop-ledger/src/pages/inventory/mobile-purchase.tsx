import { Fragment, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  useListMobilePurchases, useCreateMobilePurchase, useUpdateMobilePurchase,
  useSellMobile, useReturnMobileToStock, useDeleteMobilePurchase,
  useGetBillSettings, type MobilePurchase,
} from "@/lib/inventory-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const MOBILE_BRANDS = [
  "Apple", "Samsung", "Xiaomi", "Redmi", "POCO", "Infinix", "Tecno", "itel",
  "OPPO", "Vivo", "Realme", "OnePlus", "Honor", "Huawei", "Nokia", "Motorola",
  "Google Pixel", "Nothing", "ZTE", "Meizu", "QMobile", "Dcode", "Sparx",
  "VGO Tel", "VILLAON",
];
import {
  Cpu, Plus, Search, Smartphone, Banknote, X, Pencil, Trash2,
  ShoppingCart, RotateCcw, Printer, Download, CheckCircle2, Package, Tag,
  ChevronDown, ChevronUp, Phone, MapPin, Hash, Palette, HardDrive, ClipboardList,
  Building2, User, CalendarDays, TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

function fmt(n: number) {
  return "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtD(iso: string) {
  return format(new Date(iso), "dd MMM yyyy");
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CONDITIONS = [
  { value: "new", label: "New", color: "bg-green-100 text-green-700" },
  { value: "used", label: "Used", color: "bg-amber-100 text-amber-700" },
  { value: "refurbished", label: "Refurbished", color: "bg-blue-100 text-blue-700" },
] as const;

// ─── Bill HTML builder (shared by Print + PDF) ──────────────────────────────────
function buildBillInnerHTML(m: MobilePurchase, shopName: string, shopAddress: string, shopMobile: string) {
  const cond = CONDITIONS.find(c => c.value === m.condition)?.label ?? m.condition;
  const srcLabel = m.purchaseSource === "person" ? "👤 Seller / Person" : "🏢 Company / Supplier";
  return `
<div class="header">
  <div class="shop-name">${esc(shopName || "My Shop")}</div>
  <div class="shop-info">${esc(shopAddress || "")}${shopAddress && shopMobile ? " | " : ""}${shopMobile ? "📞 " + esc(shopMobile) : ""}</div>
</div>

<div class="bill-title">📱 Mobile Purchase Record</div>

<div class="section">
  <div class="section-title">Seller Information</div>
  <div class="row"><span class="label">Name</span><span class="value">${esc(m.sellerName)}</span></div>
  ${m.sellerPhone ? `<div class="row"><span class="label">Phone</span><span class="value">${esc(m.sellerPhone)}</span></div>` : ""}
  ${m.sellerAddress ? `<div class="row"><span class="label">Address</span><span class="value">${esc(m.sellerAddress)}</span></div>` : ""}
  <div class="row"><span class="label">Purchase Source</span><span class="value">${srcLabel}</span></div>
  <div class="row"><span class="label">Purchase Date</span><span class="value">${esc(fmtD(m.purchaseDate))}</span></div>
</div>

<div class="section">
  <div class="section-title">Mobile Details</div>
  <div class="row"><span class="label">Model</span><span class="value">${esc(m.mobileModel)}</span></div>
  <div class="row"><span class="label">Company/Brand</span><span class="value">${esc(m.company)}</span></div>
  ${m.color ? `<div class="row"><span class="label">Color</span><span class="value">${esc(m.color)}</span></div>` : ""}
  ${m.storageCapacity ? `<div class="row"><span class="label">Storage</span><span class="value">${esc(m.storageCapacity)}</span></div>` : ""}
  <div class="row"><span class="label">Condition</span><span class="value">${esc(cond)}</span></div>
  ${m.imei ? `<div class="section-title" style="margin-top:10px">IMEI 1</div><div class="imei-box">${esc(m.imei)}</div>` : ""}
  ${(m as any).imei2 ? `<div class="section-title" style="margin-top:6px">IMEI 2</div><div class="imei-box">${esc((m as any).imei2)}</div>` : ""}
</div>

<div class="price-box">
  <div class="price-row"><span>Purchase Price</span><span>${esc(fmt(m.purchasePrice))}</span></div>
  <div class="price-row"><span>Sale Price (Expected)</span><span>${esc(fmt(m.salePrice))}</span></div>
  <div class="price-row total profit"><span>Expected Profit</span><span>${esc(fmt(m.salePrice - m.purchasePrice))}</span></div>
</div>

${m.status === "sold" ? `
<div class="section" style="margin-top:14px">
  <div class="section-title">Sale Information</div>
  <div class="row"><span class="label">Status</span><span><span class="status-badge status-sold">SOLD</span></span></div>
  ${m.soldToName ? `<div class="row"><span class="label">Sold To</span><span class="value">${esc(m.soldToName)}</span></div>` : ""}
  ${m.soldToPhone ? `<div class="row"><span class="label">Buyer Phone</span><span class="value">${esc(m.soldToPhone)}</span></div>` : ""}
  ${m.soldAt ? `<div class="row"><span class="label">Sold Date</span><span class="value">${esc(fmtD(m.soldAt))}</span></div>` : ""}
  ${m.saleAmount ? `<div class="row"><span class="label">Sale Amount</span><span class="value" style="color:#16a34a;font-size:16px">${esc(fmt(m.saleAmount))}</span></div>` : ""}
  ${m.paymentMethod ? `<div class="row"><span class="label">Payment</span><span class="value">${m.paymentMethod === "cash" ? "💵 Cash" : "📱 Digital"}</span></div>` : ""}
  ${m.saleAmount ? `<div class="row" style="margin-top:8px;font-weight:bold"><span class="label">Profit</span><span class="value" style="color:#16a34a">${esc(fmt(m.saleAmount - m.purchasePrice))}</span></div>` : ""}
</div>` : `
<div style="text-align:center;margin-top:12px"><span class="status-badge status-stock">IN STOCK</span></div>`}

${m.notes ? `<div class="section" style="margin-top:12px"><div class="section-title">Notes</div><div style="font-size:13px;color:#555">${esc(m.notes)}</div></div>` : ""}

<div class="footer">Record ID: #${esc(m.id)} | Printed: ${esc(format(new Date(), "dd MMM yyyy, h:mm a"))}</div>`;
}

const BILL_STYLES = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
  .header{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:12px;margin-bottom:16px}
  .shop-name{font-size:22px;font-weight:bold}
  .shop-info{font-size:12px;color:#555;margin-top:4px}
  .bill-title{font-size:16px;font-weight:bold;text-align:center;margin:12px 0;text-transform:uppercase;letter-spacing:1px;color:#444}
  .section{margin-bottom:14px}
  .section-title{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#888;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px}
  .row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0}
  .row .label{color:#555}
  .row .value{font-weight:600}
  .imei-box{background:#f5f5f5;border:1px solid #ddd;border-radius:6px;padding:8px 12px;margin:8px 0;font-family:monospace;font-size:14px;font-weight:bold;text-align:center;letter-spacing:2px}
  .price-box{background:#1a1a1a;color:white;border-radius:8px;padding:12px;margin-top:8px}
  .price-row{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}
  .price-row.total{border-top:1px solid #444;margin-top:6px;padding-top:6px;font-size:16px;font-weight:bold}
  .profit{color:#4ade80}
  .footer{text-align:center;font-size:11px;color:#888;margin-top:20px;border-top:1px solid #eee;padding-top:12px}
  .status-badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold;text-transform:uppercase}
  .status-sold{background:#fee2e2;color:#dc2626}
  .status-stock{background:#dcfce7;color:#16a34a}
  @media print{body{padding:10px}}
`;

// ─── Print Bill ────────────────────────────────────────────────────────────────
function printPurchaseBill(m: MobilePurchase, shopName: string, shopAddress: string, shopMobile: string) {
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Mobile Purchase Bill</title>
<style>${BILL_STYLES}</style>
</head><body>${buildBillInnerHTML(m, shopName, shopAddress, shopMobile)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ─── Download Bill PDF ───────────────────────────────────────────────────────────
async function downloadPurchaseBillPDF(m: MobilePurchase, shopName: string, shopAddress: string, shopMobile: string) {
  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.left = "-9999px";
  div.style.top = "0";
  div.style.width = "760px";
  div.style.background = "#ffffff";
  div.innerHTML = `<style>${BILL_STYLES}</style><div style="padding:20px">${buildBillInnerHTML(m, shopName, shopAddress, shopMobile)}</div>`;
  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
    pdf.save(`MobileBill-${m.id}.pdf`);
  } finally {
    document.body.removeChild(div);
  }
}

// ─── Add/Edit Mobile Dialog ────────────────────────────────────────────────────
function MobileFormDialog({ open, onClose, onSubmit, isPending, initial }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  initial?: MobilePurchase | null;
}) {
  const [form, setForm] = useState({
    sellerName: "", sellerPhone: "", sellerAddress: "", sellerCnic: "",
    imei: "", imei2: "", mobileModel: "", company: "", color: "", storageCapacity: "",
    condition: "used" as "new" | "used" | "refurbished",
    purchaseSource: "company" as "company" | "person",
    purchasePrice: "", salePrice: "", notes: "",
    purchaseDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [isCredit, setIsCredit] = useState(false);

  useEffect(() => {
    if (open) {
      setIsCredit(false);
      if (initial) {
        setForm({
          sellerName: initial.sellerName,
          sellerPhone: initial.sellerPhone ?? "",
          sellerAddress: initial.sellerAddress ?? "",
          sellerCnic: (initial as any).sellerCnic ?? "",
          imei: initial.imei ?? "",
          imei2: initial.imei2 ?? "",
          mobileModel: initial.mobileModel,
          company: initial.company,
          color: initial.color ?? "",
          storageCapacity: initial.storageCapacity ?? "",
          condition: initial.condition,
          purchaseSource: initial.purchaseSource ?? "company",
          purchasePrice: String(initial.purchasePrice),
          salePrice: String(initial.salePrice),
          notes: initial.notes ?? "",
          purchaseDate: format(new Date(initial.purchaseDate), "yyyy-MM-dd"),
        });
      } else {
        setForm({ sellerName: "", sellerPhone: "", sellerAddress: "", sellerCnic: "", imei: "", imei2: "", mobileModel: "", company: "", color: "", storageCapacity: "", condition: "used", purchaseSource: "company", purchasePrice: "", salePrice: "", notes: "", purchaseDate: format(new Date(), "yyyy-MM-dd") });
      }
    }
  }, [open, initial]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const [otherCompany, setOtherCompany] = useState(false);
  useEffect(() => {
    if (open) setOtherCompany(!!initial?.company && !MOBILE_BRANDS.includes(initial.company));
  }, [open, initial]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      sellerName: form.sellerName.trim(),
      sellerPhone: form.sellerPhone || null,
      sellerAddress: form.sellerAddress || null,
      sellerCnic: form.sellerCnic || null,
      imei: form.imei || null,
      imei2: form.imei2 || null,
      mobileModel: form.mobileModel.trim(),
      company: form.company.trim(),
      color: form.color || null,
      storageCapacity: form.storageCapacity || null,
      condition: form.condition,
      purchaseSource: form.purchaseSource,
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      salePrice: parseFloat(form.salePrice) || 0,
      notes: form.notes || null,
      purchaseDate: form.purchaseDate,
      ...(initial ? {} : { isCredit }),
    });
  }

  const profit = parseFloat(form.salePrice || "0") - parseFloat(form.purchasePrice || "0");

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-violet-600" />
            {initial ? "Edit Mobile" : "New Mobile Purchase"}
          </DialogTitle>
          <DialogDescription>Enter mobile details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Seller section */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Seller Info (Who Sold the Mobile)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-xs font-medium">Seller Name *</label>
                <Input className="mt-1 h-9" placeholder="Name..." value={form.sellerName} onChange={e => set("sellerName", e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1"><Phone className="h-3 w-3" />Phone</label>
                <Input className="mt-1 h-9" placeholder="03xx..." value={form.sellerPhone} onChange={e => set("sellerPhone", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">Purchase Date</label>
                <Input type="date" className="mt-1 h-9" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />Address</label>
                <Input className="mt-1 h-9" placeholder="Home / Shop address..." value={form.sellerAddress} onChange={e => set("sellerAddress", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium">CNIC Number</label>
                <Input className="mt-1 h-9 font-mono" placeholder="12345-1234567-1" value={form.sellerCnic} onChange={e => set("sellerCnic", e.target.value)} maxLength={15} />
              </div>
            </div>
          </div>

          {/* Mobile details section */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Mobile Details</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Mobile Model *</label>
                <Input className="mt-1 h-9" placeholder="e.g. iPhone 15, Galaxy S24..." value={form.mobileModel} onChange={e => set("mobileModel", e.target.value)} required />
              </div>
              <div>
                <label className="text-xs font-medium">Company/Brand *</label>
                <Select
                  value={otherCompany ? "__other__" : (form.company || undefined)}
                  onValueChange={v => {
                    if (v === "__other__") { setOtherCompany(true); set("company", ""); }
                    else { setOtherCompany(false); set("company", v); }
                  }}
                >
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select brand..." /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {MOBILE_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    <SelectItem value="__other__">Other (type name)</SelectItem>
                  </SelectContent>
                </Select>
                {otherCompany && (
                  <Input className="mt-1 h-9" placeholder="Company name..." value={form.company} onChange={e => set("company", e.target.value)} required autoFocus />
                )}
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1"><Palette className="h-3 w-3" />Color</label>
                <Input className="mt-1 h-9" placeholder="Black, White, Gold..." value={form.color} onChange={e => set("color", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1"><HardDrive className="h-3 w-3" />Storage</label>
                <Input className="mt-1 h-9" placeholder="64GB, 128GB, 256GB..." value={form.storageCapacity} onChange={e => set("storageCapacity", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1"><Hash className="h-3 w-3" />IMEI 1</label>
                <Input className="mt-1 h-9 font-mono" placeholder="IMEI 1 (15 digits)..." value={form.imei} onChange={e => set("imei", e.target.value)} maxLength={17} />
              </div>
              <div>
                <label className="text-xs font-medium flex items-center gap-1"><Hash className="h-3 w-3" />IMEI 2 (Dual SIM)</label>
                <Input className="mt-1 h-9 font-mono" placeholder="IMEI 2 (optional)..." value={form.imei2} onChange={e => set("imei2", e.target.value)} maxLength={17} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block">Condition</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CONDITIONS.map(c => (
                    <button key={c.value} type="button" onClick={() => set("condition", c.value)}
                      className={`h-8 rounded-lg border text-xs font-semibold transition-colors ${form.condition === c.value ? "bg-violet-600 text-white border-violet-600" : "bg-white hover:border-violet-300 text-muted-foreground"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block">Source (Purchased from?)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => set("purchaseSource", "company")}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${form.purchaseSource === "company" ? "bg-violet-600 text-white border-violet-600" : "bg-white hover:border-violet-300 text-muted-foreground"}`}>
                    <Building2 className="h-3.5 w-3.5" />Company / Supplier
                  </button>
                  <button type="button" onClick={() => set("purchaseSource", "person")}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${form.purchaseSource === "person" ? "bg-amber-500 text-white border-amber-500" : "bg-white hover:border-amber-300 text-muted-foreground"}`}>
                    <User className="h-3.5 w-3.5" />Seller / Person's phone
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  {form.purchaseSource === "person"
                    ? "👤 Person-source profit is counted only in the Mobile Purchase report, not in overall profits."
                    : "🏢 Company-source profit is also counted in overall profits."}
                </p>
              </div>
            </div>
          </div>

          {/* Prices section */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Prices</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Purchase Price (Cost)</label>
                <Input type="number" className="mt-1 h-9" placeholder="0" value={form.purchasePrice} onChange={e => set("purchasePrice", e.target.value)} min={0} />
              </div>
              <div>
                <label className="text-xs font-medium">Sale Price (Expected)</label>
                <Input type="number" className="mt-1 h-9" placeholder="0" value={form.salePrice} onChange={e => set("salePrice", e.target.value)} min={0} />
              </div>
            </div>
            {profit !== 0 && (
              <div className={`text-xs font-semibold flex items-center gap-1 ${profit > 0 ? "text-green-700" : "text-red-600"}`}>
                {profit > 0 ? "✓ Expected Profit:" : "⚠ Loss:"} {fmt(Math.abs(profit))}
              </div>
            )}
            {!initial && (
              <div className="pt-1">
                <label className="text-xs font-medium mb-1 block">Payment</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => setIsCredit(false)}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${!isCredit ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:border-emerald-300 text-muted-foreground"}`}>
                    <Banknote className="h-3.5 w-3.5" />Cash
                  </button>
                  <button type="button" onClick={() => setIsCredit(true)}
                    className={`h-9 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${isCredit ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:border-blue-300 text-muted-foreground"}`}>
                    <ClipboardList className="h-3.5 w-3.5" />Credit (Udhaar)
                  </button>
                </div>
                {isCredit && (
                  <p className="text-[10px] text-blue-700 mt-1 leading-snug">
                    You owe {form.sellerName || "the seller"} {fmt(parseFloat(form.purchasePrice || "0"))} — recorded in Credits as payable.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium">Notes (Optional)</label>
            <Input className="mt-1 h-9" placeholder="Any note..." value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 h-9 bg-violet-600 hover:bg-violet-700 text-white" disabled={isPending}>
              {isPending ? "Saving..." : initial ? "Update" : "Save Mobile"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sell Dialog ───────────────────────────────────────────────────────────────
function SellDialog({ mobile, open, onClose, onSell, isPending }: {
  mobile: MobilePurchase; open: boolean; onClose: () => void;
  onSell: (data: any) => void; isPending: boolean;
}) {
  const [soldToName, setSoldToName] = useState("");
  const [soldToPhone, setSoldToPhone] = useState("");
  const [saleAmount, setSaleAmount] = useState(String(mobile.salePrice));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "digital">("cash");

  useEffect(() => {
    if (open) { setSoldToName(""); setSoldToPhone(""); setSaleAmount(String(mobile.salePrice)); setPaymentMethod("cash"); }
  }, [open, mobile.salePrice]);

  const profit = parseFloat(saleAmount || "0") - mobile.purchasePrice;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!saleAmount) return;
    onSell({ soldToName: soldToName || null, soldToPhone: soldToPhone || null, saleAmount: parseFloat(saleAmount), paymentMethod });
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-green-600" />
            Mobile Bechna — {mobile.mobileModel}
          </DialogTitle>
          <DialogDescription>Purchase price: {fmt(mobile.purchasePrice)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium">Buyer Name (Optional)</label>
            <Input className="mt-1 h-9" placeholder="Buyer name..." value={soldToName} onChange={e => setSoldToName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Buyer Phone (Optional)</label>
            <Input className="mt-1 h-9" placeholder="03xx..." value={soldToPhone} onChange={e => setSoldToPhone(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Sale Amount *</label>
            <Input type="number" className="mt-1 h-10 text-lg font-bold" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} required min={1} />
          </div>
          {profit !== 0 && (
            <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${profit >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {profit >= 0 ? "✓ Faida:" : "⚠ Nuqsan:"} {fmt(Math.abs(profit))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "digital"] as const).map(m => (
              <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                className={`flex items-center gap-2 justify-center border rounded-xl px-3 py-2 text-sm font-medium transition-colors ${paymentMethod === m ? m === "cash" ? "bg-primary text-primary-foreground border-primary" : "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-accent"}`}>
                {m === "cash" ? <Banknote className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                {m === "cash" ? "Cash" : "Digital"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 h-9 bg-green-600 hover:bg-green-700 text-white" disabled={isPending}>
              {isPending ? "..." : `Confirm Sale — ${saleAmount ? fmt(parseFloat(saleAmount)) : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mobile Detail View ────────────────────────────────────────────────────────
function MobileDetailDialog({ mobile, open, onClose, onSell, onEdit, onDelete, onReturnToStock, onPrint }: {
  mobile: MobilePurchase; open: boolean; onClose: () => void;
  onSell: () => void; onEdit: () => void; onDelete: () => void;
  onReturnToStock: () => void; onPrint: () => void;
}) {
  const isSold = mobile.status === "sold";
  const profit = mobile.saleAmount != null ? mobile.saleAmount - mobile.purchasePrice : mobile.salePrice - mobile.purchasePrice;
  const condInfo = CONDITIONS.find(c => c.value === mobile.condition);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className={`px-4 py-4 ${isSold ? "bg-slate-700" : "bg-violet-700"} text-white rounded-t-lg`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="h-5 w-5 opacity-80" />
                <Badge className={`text-[10px] border-0 font-bold ${isSold ? "bg-red-500/20 text-red-200" : "bg-green-400/20 text-green-200"}`}>
                  {isSold ? "SOLD" : "IN STOCK"}
                </Badge>
              </div>
              <p className="font-bold text-lg leading-tight">{mobile.mobileModel}</p>
              <p className="text-sm opacity-80">{mobile.company}{mobile.color ? ` • ${mobile.color}` : ""}{mobile.storageCapacity ? ` • ${mobile.storageCapacity}` : ""}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white mt-1"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Price cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-red-50 border border-red-100 rounded-xl p-2 text-center">
              <p className="text-[10px] text-red-500 font-semibold uppercase">Cost</p>
              <p className="text-sm font-bold text-red-700">{fmt(mobile.purchasePrice)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 text-center">
              <p className="text-[10px] text-blue-500 font-semibold uppercase">{isSold ? "Sold" : "Sale Price"}</p>
              <p className="text-sm font-bold text-blue-700">{fmt(isSold && mobile.saleAmount ? mobile.saleAmount : mobile.salePrice)}</p>
            </div>
            <div className={`rounded-xl p-2 text-center border ${profit >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
              <p className={`text-[10px] font-semibold uppercase ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>Faida</p>
              <p className={`text-sm font-bold ${profit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(profit)}</p>
            </div>
          </div>

          {/* Seller info */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Seller</p>
            <div className="bg-muted/30 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-sm">{mobile.sellerName}</p>
              {mobile.sellerPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{mobile.sellerPhone}</p>}
              {mobile.sellerAddress && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{mobile.sellerAddress}</p>}
              <p className="text-xs text-muted-foreground">Purchased: {fmtD(mobile.purchaseDate)}</p>
            </div>
          </div>

          {/* Mobile details */}
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mobile Details</p>
            <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
              {condInfo && <Badge className={`text-[10px] border-0 ${condInfo.color}`}>{condInfo.label}</Badge>}
              {(mobile.imei || (mobile as any).imei2) && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">IMEI</p>
                  {mobile.imei && <p className="font-mono text-sm font-bold tracking-wider">{mobile.imei}</p>}
                  {(mobile as any).imei2 && <p className="font-mono text-xs text-muted-foreground tracking-wider">{(mobile as any).imei2} <span className="font-normal text-[10px]">(IMEI 2)</span></p>}
                </div>
              )}
              {mobile.notes && <p className="text-xs text-muted-foreground italic">📝 {mobile.notes}</p>}
            </div>
          </div>

          {/* Sold info */}
          {isSold && (mobile.soldToName || mobile.soldAt || mobile.saleAmount) && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sale Details</p>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1">
                {mobile.soldToName && <p className="font-semibold text-sm">Buyer: {mobile.soldToName}</p>}
                {mobile.soldToPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{mobile.soldToPhone}</p>}
                {mobile.soldAt && <p className="text-xs text-muted-foreground">Sold: {fmtD(mobile.soldAt)}</p>}
                {mobile.paymentMethod && <Badge className="text-[10px] border-0 bg-blue-100 text-blue-700">{mobile.paymentMethod === "cash" ? "💵 Cash" : "📱 Digital"}</Badge>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" className="h-9 text-sm gap-1.5" onClick={onPrint}>
              <Printer className="h-3.5 w-3.5" />Print Bill
            </Button>
            <Button variant="outline" className="h-9 text-sm gap-1.5" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />Edit
            </Button>
            {!isSold ? (
              <Button onClick={onSell} className="h-9 col-span-2 bg-green-600 hover:bg-green-700 text-white gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />Sell This Mobile
              </Button>
            ) : (
              <Button variant="outline" className="h-9 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={onReturnToStock}>
                <RotateCcw className="h-3.5 w-3.5" />Return to Stock
              </Button>
            )}
            <Button variant="outline" className="h-9 gap-1.5 text-red-500 border-red-200 hover:bg-red-50 col-span-2" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />Delete Record
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Profit Report Tab ──────────────────────────────────────────────────────────
type ProfitPeriod = "today" | "7days" | "weekly" | "monthly" | "yearly";

function getPeriodDates(period: ProfitPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  if (period === "today")   return { from: iso(now),                                to: iso(now),                              label: "Today" };
  if (period === "7days")   return { from: iso(subDays(now, 6)),                    to: iso(now),                              label: "Last 7 Days" };
  if (period === "weekly")  return { from: iso(startOfWeek(now, { weekStartsOn: 1 })), to: iso(endOfWeek(now, { weekStartsOn: 1 })), label: "This Week" };
  if (period === "monthly") return { from: iso(startOfMonth(now)),                  to: iso(endOfMonth(now)),                  label: "This Month" };
  return                           { from: iso(startOfYear(now)),                   to: iso(endOfYear(now)),                   label: "This Year" };
}

function MobileProfitReport({ mobiles }: { mobiles: MobilePurchase[] }) {
  const [period, setPeriod] = useState<ProfitPeriod>("monthly");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const { from, to, label } = getPeriodDates(period);

  const periods: { key: ProfitPeriod; label: string }[] = [
    { key: "today",   label: "Today"   },
    { key: "7days",   label: "7 Days"  },
    { key: "weekly",  label: "Weekly"  },
    { key: "monthly", label: "Monthly" },
    { key: "yearly",  label: "Yearly"  },
  ];

  // sold mobiles within period (by soldAt date)
  const sold = mobiles.filter(m => {
    if (m.status !== "sold" || !m.soldAt) return false;
    const d = format(new Date(m.soldAt), "yyyy-MM-dd");
    return d >= from && d <= to;
  });

  const saleOf = (m: MobilePurchase) => m.saleAmount ?? 0;
  const profitOf = (m: MobilePurchase) => saleOf(m) - m.purchasePrice;

  const totalSold = sold.length;
  const totalSale = sold.reduce((s, m) => s + saleOf(m), 0);
  const totalCost = sold.reduce((s, m) => s + m.purchasePrice, 0);
  const totalProfit = sold.reduce((s, m) => s + profitOf(m), 0);
  const companyProfit = sold.filter(m => m.purchaseSource !== "person").reduce((s, m) => s + profitOf(m), 0);
  const personProfit = sold.filter(m => m.purchaseSource === "person").reduce((s, m) => s + profitOf(m), 0);

  // day-wise breakdown
  const byDay: Record<string, MobilePurchase[]> = {};
  for (const m of sold) {
    const d = format(new Date(m.soldAt as string), "yyyy-MM-dd");
    (byDay[d] ??= []).push(m);
  }
  const days = Object.entries(byDay)
    .map(([date, items]) => ({
      date,
      items,
      sale: items.reduce((s, m) => s + saleOf(m), 0),
      profit: items.reduce((s, m) => s + profitOf(m), 0),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-5 pb-6">
      {/* Period selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {periods.map(p => (
          <Button key={p.key} size="sm" variant={period === p.key ? "default" : "outline"}
            className={`h-8 text-xs ${period === p.key ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}`}
            onClick={() => setPeriod(p.key)}>
            {p.label}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-1">{from} → {to}</span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border-2 border-violet-200 rounded-xl p-4 bg-violet-50 text-center">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">Total Sold</p>
          <p className="text-3xl font-bold text-violet-700">{totalSold}</p>
          <p className="text-xs text-violet-500 mt-0.5">{label}</p>
        </div>
        <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50 text-center">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Total Sale</p>
          <p className="text-xl font-bold text-blue-700">{fmt(totalSale)}</p>
        </div>
        <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50 text-center">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Total Cost</p>
          <p className="text-xl font-bold text-red-700">{fmt(totalCost)}</p>
        </div>
        <div className={`border-2 rounded-xl p-4 text-center ${totalProfit >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>Total Profit</p>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(totalProfit)}</p>
        </div>
      </div>

      {/* Profit split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50/60 flex items-center gap-3">
          <Building2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-700">Included in overall profits (Company)</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(companyProfit)}</p>
          </div>
        </div>
        <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/60 flex items-center gap-3">
          <User className="h-6 w-6 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-700">Only here (Person)</p>
            <p className="text-lg font-bold text-amber-700">{fmt(personProfit)}</p>
            <p className="text-[10px] text-amber-600/80">Not counted in overall profits</p>
          </div>
        </div>
      </div>

      {/* Day-wise breakdown */}
      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <TrendingUp className="h-12 w-12 opacity-20" />
          <p className="font-medium">No mobiles sold in this period</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-50 text-teal-800">
                <th className="text-left py-2.5 px-3 font-semibold w-10">#</th>
                <th className="text-left py-2.5 px-3 font-semibold">Date</th>
                <th className="text-right py-2.5 px-3 font-semibold">Mobiles Sold</th>
                <th className="text-right py-2.5 px-3 font-semibold">Sale Amount</th>
                <th className="text-right py-2.5 px-3 font-semibold">Profit</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, idx) => {
                const isOpen = openDay === day.date;
                return (
                  <Fragment key={day.date}>
                    <tr className="border-t hover:bg-muted/10 cursor-pointer"
                      onClick={() => setOpenDay(isOpen ? null : day.date)}>
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">{fmtD(day.date)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-violet-700">{day.items.length}</td>
                      <td className="py-2 px-3 text-right text-blue-700">{fmt(day.sale)}</td>
                      <td className={`py-2 px-3 text-right font-bold ${day.profit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(day.profit)}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="p-0 bg-muted/20">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-teal-50/70 text-teal-700">
                                  <th className="text-left py-2 px-3 font-semibold w-8">#</th>
                                  <th className="text-left py-2 px-3 font-semibold">Model</th>
                                  <th className="text-left py-2 px-3 font-semibold">Company</th>
                                  <th className="text-left py-2 px-3 font-semibold">IMEI</th>
                                  <th className="text-left py-2 px-3 font-semibold">Seller</th>
                                  <th className="text-left py-2 px-3 font-semibold">Sold Date</th>
                                  <th className="text-right py-2 px-3 font-semibold">Buy</th>
                                  <th className="text-right py-2 px-3 font-semibold">Sale</th>
                                  <th className="text-right py-2 px-3 font-semibold">Profit</th>
                                  <th className="text-left py-2 px-3 font-semibold">Source</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.items.map((m, i) => (
                                  <tr key={m.id} className="border-t border-teal-100/50">
                                    <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
                                    <td className="py-1.5 px-3 font-medium">{m.mobileModel}</td>
                                    <td className="py-1.5 px-3 text-muted-foreground">{m.company}</td>
                                    <td className="py-1.5 px-3 font-mono text-muted-foreground">{m.imei || "—"}</td>
                                    <td className="py-1.5 px-3 text-muted-foreground">
                                      <div className="font-medium text-foreground">{m.sellerName || "—"}</div>
                                      {m.sellerPhone && <div className="text-[10px]">{m.sellerPhone}</div>}
                                    </td>
                                    <td className="py-1.5 px-3">{m.soldAt ? fmtD(m.soldAt) : "—"}</td>
                                    <td className="py-1.5 px-3 text-right text-red-600">{fmt(m.purchasePrice)}</td>
                                    <td className="py-1.5 px-3 text-right text-blue-700">{fmt(saleOf(m))}</td>
                                    <td className={`py-1.5 px-3 text-right font-semibold ${profitOf(m) >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(profitOf(m))}</td>
                                    <td className="py-1.5 px-3">
                                      {m.purchaseSource === "person"
                                        ? <Badge className="text-[9px] px-1.5 py-0 h-4 border-0 bg-amber-100 text-amber-700">👤 Person</Badge>
                                        : <Badge className="text-[9px] px-1.5 py-0 h-4 border-0 bg-emerald-100 text-emerald-700">🏢 Company</Badge>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sellers Report Tab ─────────────────────────────────────────────────────────
function MobileSellersReport({ mobiles, search }: { mobiles: MobilePurchase[]; search: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  // group by seller name + phone
  const groups: Record<string, {
    key: string; name: string; phone: string; address: string; items: MobilePurchase[];
  }> = {};
  for (const m of mobiles) {
    const name = (m.sellerName || "").trim();
    const phone = (m.sellerPhone || "").trim();
    const key = `${name.toLowerCase()}|${phone.toLowerCase()}`;
    if (!groups[key]) groups[key] = { key, name: name || "—", phone, address: (m.sellerAddress || "").trim(), items: [] };
    if (!groups[key].address && m.sellerAddress) groups[key].address = m.sellerAddress.trim();
    groups[key].items.push(m);
  }

  const q = search.trim().toLowerCase();
  let sellers = Object.values(groups).map(g => {
    const totalBuy = g.items.reduce((s, m) => s + m.purchasePrice, 0);
    const sold = g.items.filter(m => m.status === "sold");
    const inStock = g.items.filter(m => m.status === "in_stock");
    const profit = sold.reduce((s, m) => s + ((m.saleAmount ?? 0) - m.purchasePrice), 0);
    return { ...g, totalBuy, soldCount: sold.length, stockCount: inStock.length, profit };
  });

  if (q) {
    sellers = sellers.filter(s => s.name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q));
  }
  sellers.sort((a, b) => b.items.length - a.items.length);

  if (sellers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
        <Users className="h-12 w-12 opacity-20" />
        <p className="font-medium">{q ? "No seller found" : "No sellers yet"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span><span className="font-bold text-foreground">{sellers.length}</span> sellers / persons</span>
      </div>
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-50 text-teal-800">
                <th className="text-left py-2.5 px-3 font-semibold w-10">#</th>
                <th className="text-left py-2.5 px-3 font-semibold">Seller Name</th>
                <th className="text-left py-2.5 px-3 font-semibold">Phone</th>
                <th className="text-left py-2.5 px-3 font-semibold">Address</th>
                <th className="text-right py-2.5 px-3 font-semibold">Mobiles</th>
                <th className="text-right py-2.5 px-3 font-semibold">Total Buy</th>
                <th className="text-right py-2.5 px-3 font-semibold">Sold</th>
                <th className="text-right py-2.5 px-3 font-semibold">In Stock</th>
                <th className="text-right py-2.5 px-3 font-semibold">Profit</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((s, idx) => {
                const isOpen = openKey === s.key;
                return (
                  <Fragment key={s.key}>
                    <tr className="border-t hover:bg-muted/10 cursor-pointer" onClick={() => setOpenKey(isOpen ? null : s.key)}>
                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">{s.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{s.phone || "—"}</td>
                      <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">{s.address || "—"}</td>
                      <td className="py-2 px-3 text-right font-semibold text-violet-700">{s.items.length}</td>
                      <td className="py-2 px-3 text-right text-red-600">{fmt(s.totalBuy)}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{s.soldCount}</td>
                      <td className="py-2 px-3 text-right text-green-700">{s.stockCount}</td>
                      <td className={`py-2 px-3 text-right font-bold ${s.profit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(s.profit)}</td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="p-0 bg-muted/20">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-teal-50/70 text-teal-700">
                                  <th className="text-left py-2 px-3 font-semibold w-8">#</th>
                                  <th className="text-left py-2 px-3 font-semibold">Model</th>
                                  <th className="text-left py-2 px-3 font-semibold">Company</th>
                                  <th className="text-left py-2 px-3 font-semibold">IMEI</th>
                                  <th className="text-left py-2 px-3 font-semibold">Purchase Date</th>
                                  <th className="text-right py-2 px-3 font-semibold">Buy</th>
                                  <th className="text-left py-2 px-3 font-semibold">Status</th>
                                  <th className="text-right py-2 px-3 font-semibold">Sale</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.items.map((m, i) => {
                                  const isSold = m.status === "sold";
                                  return (
                                    <tr key={m.id} className="border-t border-teal-100/50">
                                      <td className="py-1.5 px-3 text-muted-foreground">{i + 1}</td>
                                      <td className="py-1.5 px-3 font-medium">{m.mobileModel}</td>
                                      <td className="py-1.5 px-3 text-muted-foreground">{m.company}</td>
                                      <td className="py-1.5 px-3 font-mono text-muted-foreground">{m.imei || "—"}</td>
                                      <td className="py-1.5 px-3">{fmtD(m.purchaseDate)}</td>
                                      <td className="py-1.5 px-3 text-right text-red-600">{fmt(m.purchasePrice)}</td>
                                      <td className="py-1.5 px-3">
                                        <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 font-bold ${isSold ? "bg-slate-200 text-slate-600" : "bg-green-100 text-green-700"}`}>
                                          {isSold ? "Sold" : "In Stock"}
                                        </Badge>
                                      </td>
                                      <td className="py-1.5 px-3 text-right text-blue-700">{isSold && m.saleAmount != null ? fmt(m.saleAmount) : "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MobilePurchasePage() {
  const { toast } = useToast();
  useEffect(() => { document.title = "Mobile Purchase"; }, []);

  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"in_stock" | "sold" | "all" | "profit" | "sellers">("in_stock");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MobilePurchase | null>(null);
  const [detailTarget, setDetailTarget] = useState<MobilePurchase | null>(null);
  const [sellTarget, setSellTarget] = useState<MobilePurchase | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: mobiles = [], isLoading } = useListMobilePurchases({ search: search || undefined });
  const { data: settings } = useGetBillSettings();
  const createMobile = useCreateMobilePurchase();
  const updateMobile = useUpdateMobilePurchase();
  const sellMobile = useSellMobile();
  const returnToStock = useReturnMobileToStock();
  const deleteMobile = useDeleteMobilePurchase();

  const filtered = mobiles.filter(m => tab === "all" ? true : m.status === tab);

  const inStockCount = mobiles.filter(m => m.status === "in_stock").length;
  const soldCount = mobiles.filter(m => m.status === "sold").length;
  const totalInvestment = mobiles.filter(m => m.status === "in_stock").reduce((s, m) => s + m.purchasePrice, 0);
  const totalProfit = mobiles.filter(m => m.status === "sold").reduce((s, m) => s + (m.saleAmount ?? 0) - m.purchasePrice, 0);

  async function handleCreate(data: any) {
    createMobile.mutate(data, {
      onSuccess: () => { setAddOpen(false); toast({ title: "Mobile added" }); },
      onError: (e: any) => toast({ title: "Error", description: e.error, variant: "destructive" }),
    });
  }

  async function handleUpdate(data: any) {
    if (!editTarget) return;
    updateMobile.mutate({ id: editTarget.id, data }, {
      onSuccess: () => { setEditTarget(null); setDetailTarget(null); toast({ title: "Updated" }); },
      onError: (e: any) => toast({ title: "Error", description: e.error, variant: "destructive" }),
    });
  }

  function handleSell(data: any) {
    if (!sellTarget) return;
    sellMobile.mutate({ id: sellTarget.id, data }, {
      onSuccess: (updated) => {
        setSellTarget(null);
        setDetailTarget(null);
        toast({ title: "Mobile sold!", description: `${updated.mobileModel} — ${updated.saleAmount ? fmt(updated.saleAmount) : ""}` });
      },
      onError: (e: any) => toast({ title: "Error", description: e.error, variant: "destructive" }),
    });
  }

  function handleReturnToStock(id: number) {
    returnToStock.mutate(id, {
      onSuccess: () => { setDetailTarget(null); toast({ title: "Returned to stock" }); },
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this mobile record?")) return;
    deleteMobile.mutate(id, {
      onSuccess: () => { setDetailTarget(null); toast({ title: "Deleted" }); },
    });
  }

  function handlePrint(m: MobilePurchase) {
    printPurchaseBill(m, settings?.shopName ?? "", settings?.address ?? "", settings?.mobile ?? "");
  }

  async function handleDownloadPDF(m: MobilePurchase) {
    try {
      await downloadPurchaseBillPDF(m, settings?.shopName ?? "", settings?.address ?? "", settings?.mobile ?? "");
    } catch (e: any) {
      toast({ title: "PDF error", description: e?.message ?? "Failed to generate PDF", variant: "destructive" });
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
        <Cpu className="h-5 w-5 text-violet-600" />
        <h1 className="font-bold text-base">Mobile Purchase</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/inventory/bulk-mobile-purchase")} className="h-8">
            <ClipboardList className="h-3.5 w-3.5 mr-1" />Bulk Add
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-8 bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-3.5 w-3.5 mr-1" />Add Mobile
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/10 shrink-0 text-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Package className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-muted-foreground">In Stock:</span>
          <span className="font-bold text-violet-700">{inStockCount}</span>
        </div>
        <div className="w-px bg-border h-4 flex-shrink-0" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Tag className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-muted-foreground">Investment:</span>
          <span className="font-bold text-blue-700">{fmt(totalInvestment)}</span>
        </div>
        <div className="w-px bg-border h-4 flex-shrink-0" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted-foreground">Sold:</span>
          <span className="font-bold">{soldCount}</span>
        </div>
        <div className="w-px bg-border h-4 flex-shrink-0" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-muted-foreground">Profit:</span>
          <span className={`font-bold ${totalProfit >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(totalProfit)}</span>
        </div>
      </div>

      {/* Tab + Search bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <div className="flex border rounded-lg overflow-hidden shrink-0">
          {(["in_stock", "sold", "all", "profit", "sellers"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`h-8 px-3 text-xs font-medium transition-colors ${tab === t ? "bg-violet-600 text-white" : "hover:bg-muted"}`}>
              {t === "in_stock" ? `📦 In Stock (${inStockCount})` : t === "sold" ? `✅ Sold (${soldCount})` : t === "all" ? "All" : t === "profit" ? "📊 Profit Report" : "👥 Sellers"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-violet-400"
            placeholder="Model, company, IMEI, seller..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-red-500"><X className="h-4 w-4" /></button>}
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {tab === "profit" ? (
          <MobileProfitReport mobiles={mobiles} />
        ) : tab === "sellers" ? (
          isLoading ? (
            <div className="text-center text-muted-foreground py-10">Loading...</div>
          ) : (
            <MobileSellersReport mobiles={mobiles} search={search} />
          )
        ) : isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Cpu className="h-14 w-14 opacity-20" />
            <p className="font-medium">{search ? "No mobile found" : tab === "in_stock" ? "No mobiles in stock" : "No records found"}</p>
            {!search && <Button size="sm" onClick={() => setAddOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white"><Plus className="h-3.5 w-3.5 mr-1" />Add First Mobile</Button>}
          </div>
        ) : (
          filtered.map(m => {
            const isSold = m.status === "sold";
            const isExpanded = expanded === m.id;
            const profit = isSold && m.saleAmount != null ? m.saleAmount - m.purchasePrice : m.salePrice - m.purchasePrice;

            return (
              <div key={m.id} className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${isSold ? "border-slate-200 bg-slate-50/50" : "border-violet-100 bg-white"}`}>
                {/* Main row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSold ? "bg-slate-200" : "bg-violet-100"}`}>
                    <Cpu className={`h-5 w-5 ${isSold ? "text-slate-500" : "text-violet-600"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm">{m.mobileModel}</span>
                      <span className="text-xs text-muted-foreground">{m.company}</span>
                      {m.color && <span className="text-xs text-muted-foreground">• {m.color}</span>}
                      {m.storageCapacity && <span className="text-xs text-muted-foreground">• {m.storageCapacity}</span>}
                      <Badge className={`text-[9px] px-1.5 py-0 h-3.5 border-0 ${CONDITIONS.find(c => c.value === m.condition)?.color}`}>
                        {CONDITIONS.find(c => c.value === m.condition)?.label}
                      </Badge>
                      {m.purchaseSource === "person" && (
                        <Badge className="text-[9px] px-1.5 py-0 h-3.5 border-0 bg-amber-100 text-amber-700">👤 Person</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">Seller: {m.sellerName}</span>
                      {m.imei && <span className="text-[10px] font-mono text-muted-foreground/70">IMEI1: {m.imei}</span>}
                      {(m as any).imei2 && <span className="text-[10px] font-mono text-muted-foreground/70">· IMEI2: {(m as any).imei2}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-red-600 font-medium">Buy: {fmt(m.purchasePrice)}</span>
                      <span className="text-xs text-blue-600 font-medium">Sell: {fmt(isSold && m.saleAmount ? m.saleAmount : m.salePrice)}</span>
                      <span className={`text-xs font-semibold ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {profit >= 0 ? "+" : ""}{fmt(profit)}
                      </span>
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge className={`text-[10px] border-0 font-bold ${isSold ? "bg-slate-200 text-slate-600" : "bg-green-100 text-green-700"}`}>
                      {isSold ? "SOLD" : "STOCK"}
                    </Badge>
                    <button onClick={() => setDetailTarget(m)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Quick actions row */}
                <div className="flex items-center gap-1.5 px-3 pb-2.5">
                  <button onClick={() => handlePrint(m)}
                    className="h-7 px-2.5 rounded-lg text-xs border hover:bg-muted flex items-center gap-1 text-muted-foreground">
                    <Printer className="h-3 w-3" />Bill
                  </button>
                  <button onClick={() => handleDownloadPDF(m)}
                    className="h-7 px-2.5 rounded-lg text-xs border hover:bg-muted flex items-center gap-1 text-muted-foreground">
                    <Download className="h-3 w-3" />PDF
                  </button>
                  <button onClick={() => { setEditTarget(m); }}
                    className="h-7 px-2.5 rounded-lg text-xs border hover:bg-muted flex items-center gap-1 text-muted-foreground">
                    <Pencil className="h-3 w-3" />Edit
                  </button>
                  {!isSold ? (
                    <button onClick={() => setSellTarget(m)}
                      className="h-7 px-2.5 rounded-lg text-xs border border-green-200 bg-green-50 hover:bg-green-100 flex items-center gap-1 text-green-700 font-semibold ml-auto">
                      <ShoppingCart className="h-3 w-3" />Sell
                    </button>
                  ) : (
                    <button onClick={() => handleReturnToStock(m.id)}
                      className="h-7 px-2.5 rounded-lg text-xs border border-amber-200 bg-amber-50 hover:bg-amber-100 flex items-center gap-1 text-amber-700 ml-auto">
                      <RotateCcw className="h-3 w-3" />Return
                    </button>
                  )}
                  <button onClick={() => handleDelete(m.id)}
                    className="h-7 w-7 rounded-lg text-xs border border-red-100 hover:bg-red-50 flex items-center justify-center text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialogs */}
      <MobileFormDialog
        open={addOpen || !!editTarget}
        onClose={() => { setAddOpen(false); setEditTarget(null); }}
        onSubmit={editTarget ? handleUpdate : handleCreate}
        isPending={(editTarget ? updateMobile.isPending : createMobile.isPending)}
        initial={editTarget}
      />

      {detailTarget && (
        <MobileDetailDialog
          mobile={detailTarget}
          open={!!detailTarget}
          onClose={() => setDetailTarget(null)}
          onSell={() => setSellTarget(detailTarget)}
          onEdit={() => setEditTarget(detailTarget)}
          onDelete={() => handleDelete(detailTarget.id)}
          onReturnToStock={() => handleReturnToStock(detailTarget.id)}
          onPrint={() => handlePrint(detailTarget)}
        />
      )}

      {sellTarget && (
        <SellDialog
          mobile={sellTarget}
          open={!!sellTarget}
          onClose={() => setSellTarget(null)}
          onSell={handleSell}
          isPending={sellMobile.isPending}
        />
      )}
    </div>
  );
}
