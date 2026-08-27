import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCredits,
  useCreateCredit,
  useUpdateCredit,
  useDeleteCredit,
  useListCustomers,
  useCreateEntry,
  useListEntries,
  getListCreditsQueryKey,
  getGetReportSummaryQueryKey,
  getListEntriesQueryKey,
} from "@workspace/api-client-react";
import {
  Users, Plus, Loader2, CheckCircle2, Trash2, Banknote, Smartphone,
  ArrowDownCircle, ArrowUpCircle, Wallet, Phone, Search, X, ChevronRight,
  Building2, ShoppingCart, Printer, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function fmt(n: number) {
  return "Rs " + Math.abs(n).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy");
}

type Credit = {
  id: number; customerName: string; phone?: string | null;
  amount: number; description?: string | null; type: string;
  status: string; dueDate?: string | null; createdAt: string;
};
type LedgerEntry = {
  id: number; type: string; amount: number; description?: string | null;
  paymentMethod: string; isCredit: boolean; customerName?: string | null; entryDate: string;
};

function statementRows(credits: Credit[], entries: LedgerEntry[], side: "customer" | "supplier") {
  return [
    ...credits.filter(c => !c.description?.includes("payment adjustment for entry #")).map(c => ({
      date: new Date(c.createdAt),
      type: side === "customer" ? "Credit Given" : "Purchase Credit",
      description: c.description || "Credit entry",
      amount: c.amount,
      direction: "credit" as const,
      status: c.status === "pending" ? "Outstanding" : "Cleared",
    })),
    ...entries.filter(e => !e.isCredit).map(e => ({
      date: new Date(e.entryDate),
      type: side === "customer" ? "Payment Received" : "Payment Made",
      description: e.description || "Payment",
      amount: e.amount,
      direction: "payment" as const,
      status: "Paid",
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function printCreditStatement(name: string, side: "customer" | "supplier", balance: number, rows: ReturnType<typeof statementRows>) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;
  const title = side === "customer" ? "Customer Credit Statement" : "Supplier Credit Statement";
  popup.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;color:#0f172a;padding:32px}h1{margin:0;font-size:24px}
    .meta{display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:20px}
    .balance{text-align:right}.balance strong{display:block;font-size:22px;color:${side === "customer" ? "#dc2626" : "#b45309"}}
    table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border-bottom:1px solid #cbd5e1;text-align:left}
    th{background:#f1f5f9}td.amount,th.amount{text-align:right}footer{margin-top:28px;color:#64748b;font-size:11px}
  </style></head><body><div class="meta"><div><h1>${title}</h1><p>${name}</p></div>
  <div class="balance">Outstanding Balance<strong>${fmt(balance)}</strong></div></div>
  <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Status</th><th class="amount">Amount</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${format(r.date, "dd MMM yyyy, h:mm a")}</td><td>${r.type}</td><td>${r.description}</td><td>${r.status}</td><td class="amount">${r.direction === "payment" ? "-" : ""}${fmt(r.amount)}</td></tr>`).join("")}
  </tbody></table><footer>Generated ${format(new Date(), "dd MMM yyyy, h:mm a")} · Shop Ledger Pro</footer></body></html>`);
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 250);
}

async function downloadCreditStatement(name: string, side: "customer" | "supplier", balance: number, rows: ReturnType<typeof statementRows>) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const title = side === "customer" ? "Customer Credit Statement" : "Supplier Credit Statement";
  doc.setFontSize(18); doc.text(title, 14, 18);
  doc.setFontSize(12); doc.text(name, 14, 27);
  doc.setFontSize(11); doc.text(`Outstanding Balance: ${fmt(balance)}`, 14, 36);
  doc.setFontSize(9);
  let y = 48;
  rows.forEach(r => {
    if (y > 280) { doc.addPage(); y = 18; }
    const description = `${format(r.date, "dd MMM yyyy")}  ${r.type}  ${r.description}`.slice(0, 82);
    doc.text(description, 14, y);
    doc.text(`${r.direction === "payment" ? "-" : ""}${fmt(r.amount)}`, 196, y, { align: "right" });
    y += 7;
  });
  doc.save(`${side}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-statement.pdf`);
}

// ─── Customer Detail Dialog ────────────────────────────────────────────────────
function CustomerDetailDialog({
  customerName, credits, ledgerEntries, open, onClose,
  onMarkPaid, onDelete, onCollect,
}: {
  customerName: string; credits: Credit[]; ledgerEntries: LedgerEntry[];
  open: boolean; onClose: () => void;
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
  onCollect: (name: string, amount: number, method: "cash" | "digital") => void;
}) {
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [collectMethod, setCollectMethod] = useState<"cash" | "digital">("cash");
  const [showCollect, setShowCollect] = useState(false);

  const balance = credits.filter(c => c.type === "given" && c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const collected = ledgerEntries.filter(e => !e.isCredit && e.type === "cash_in").reduce((s, e) => s + e.amount, 0);
  const phone = credits.find(c => c.phone)?.phone;

  type TimelineItem = { kind: "credit"; data: Credit; date: Date } | { kind: "entry"; data: LedgerEntry; date: Date };
  const timeline: TimelineItem[] = [
    ...credits.filter(c => !c.description?.includes("payment adjustment for entry #")).map(c => ({ kind: "credit" as const, data: c, date: new Date(c.createdAt) })),
    ...ledgerEntries.map(e => ({ kind: "entry" as const, data: e, date: new Date(e.entryDate) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const printableRows = statementRows(credits, ledgerEntries, "customer");

  function handleCollect() {
    const amt = parseFloat(collectAmount);
    if (!amt || amt <= 0) return;
    onCollect(customerName, amt, collectMethod);
    setCollectAmount("");
    setShowCollect(false);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl sm:w-[95vw] sm:max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 text-white px-5 py-4 rounded-t-lg flex-shrink-0">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
              balance > 0 ? "bg-red-500" : "bg-green-500"
            }`}>
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-lg">{customerName}</p>
              {phone && <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" />{phone}</p>}
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button title="Download PDF" onClick={() => downloadCreditStatement(customerName, "customer", balance, printableRows)}
                className="h-8 w-8 sm:w-auto sm:px-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-700 flex items-center justify-center gap-1 text-xs"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span></button>
              <button title="Print statement" onClick={() => printCreditStatement(customerName, "customer", balance, printableRows)}
                className="h-8 w-8 sm:w-auto sm:px-2 rounded border border-slate-600 text-slate-200 hover:bg-slate-700 flex items-center justify-center gap-1 text-xs"><Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline">Print</span></button>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-400">Outstanding Balance</p>
                <p className={`text-xl font-bold ${balance > 0 ? "text-red-300" : "text-green-300"}`}>{fmt(balance)}</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white ml-1 sm:ml-2"><X className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

        {/* Summary + Collect */}
        <div className="px-3 sm:px-5 py-3 border-b bg-slate-50 flex-shrink-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Balance Due</p>
              <p className="text-lg font-bold text-red-700 mt-0.5">{fmt(balance)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-wide">Collected</p>
              <p className="text-lg font-bold text-green-700 mt-0.5">{fmt(collected)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Transactions</p>
              <p className="text-lg font-bold text-slate-700 mt-0.5">{timeline.length}</p>
            </div>
          </div>

          {balance > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => { setShowCollect(v => !v); setCollectAmount(String(balance)); }}
                className="w-full flex items-center justify-between bg-green-50 border border-green-200 hover:bg-green-100 rounded-xl px-4 py-2.5 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-green-700">
                  <ArrowDownCircle className="h-4 w-4" /> Collect Payment
                </span>
                <span className="text-sm font-bold text-green-700">{fmt(balance)}</span>
              </button>
              {showCollect && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button onClick={() => setCollectAmount(String(Math.round(balance / 2)))}
                      className="h-8 text-xs border border-green-200 rounded-lg bg-white hover:bg-green-50 font-medium">
                      Half — {fmt(Math.round(balance / 2))}
                    </button>
                    <button onClick={() => setCollectAmount(String(balance))}
                      className="h-8 text-xs border border-green-300 rounded-lg bg-white hover:bg-green-50 font-medium text-green-700">
                      Full — {fmt(balance)}
                    </button>
                    <Input type="number" placeholder="Custom amount..." value={collectAmount}
                      onChange={e => setCollectAmount(e.target.value)} className="h-8 text-sm font-bold bg-white" />
                  </div>
                  {parseFloat(collectAmount) > 0 && parseFloat(collectAmount) < balance && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      Partial payment — Remaining after this: <strong>{fmt(balance - parseFloat(collectAmount))}</strong>
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:flex gap-2">
                    {(["cash", "digital"] as const).map(m => (
                      <button key={m} onClick={() => setCollectMethod(m)}
                        className={`flex items-center gap-2 justify-center border rounded-xl px-4 py-2 text-sm font-medium transition-colors flex-1 ${
                          collectMethod === m
                            ? m === "cash" ? "bg-primary text-primary-foreground border-primary" : "bg-blue-600 text-white border-blue-600"
                            : "bg-white hover:bg-accent"
                        }`}>
                        {m === "cash" ? <Banknote className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                        {m === "cash" ? "Cash" : "Digital"}
                      </button>
                    ))}
                    <Button onClick={handleCollect} disabled={!parseFloat(collectAmount) || parseFloat(collectAmount) <= 0}
                      className="col-span-2 sm:col-span-1 flex-1 bg-green-600 hover:bg-green-700 h-10">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Confirm {collectAmount ? fmt(parseFloat(collectAmount)) : ""}
                    </Button>
                    <Button variant="ghost" className="col-span-2 sm:col-span-1 h-10 px-3" onClick={() => setShowCollect(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction Table */}
        <div className="flex-1 overflow-auto">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-5 py-2 border-b bg-white sticky top-0">
            Transaction History — {timeline.length} records
          </p>
          {timeline.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">No transactions found</div>
          ) : (
            <table className="w-full min-w-[760px] text-sm border-collapse">
              <thead className="sticky top-8 z-10">
                <tr className="bg-slate-100 text-slate-600 text-xs border-b">
                  <th className="py-2 px-4 text-left font-semibold w-[140px]">Date & Time</th>
                  <th className="py-2 px-4 text-left font-semibold w-[130px]">Type</th>
                  <th className="py-2 px-4 text-left font-semibold">Description</th>
                  <th className="py-2 px-4 text-center font-semibold w-[80px]">Method</th>
                  <th className="py-2 px-4 text-center font-semibold w-[90px]">Status</th>
                  <th className="py-2 px-4 text-right font-semibold w-[110px]">Amount</th>
                  <th className="py-2 px-3 text-center font-semibold w-[70px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((item, idx) => {
                  const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                  if (item.kind === "credit") {
                    const c = item.data;
                    const isGiven = c.type === "given";
                    const isPending = c.status === "pending";
                    return (
                      <tr key={`c-${c.id}`} className={`${rowBg} border-b hover:bg-blue-50/30 transition-colors`}>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {format(item.date, "dd MMM yyyy")}<br />
                          <span className="text-[10px]">{format(item.date, "h:mm a")}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${isGiven ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                            {isGiven ? "Credit Given" : "Credit Received"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {c.description || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center"><span className="text-xs text-muted-foreground">—</span></td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 ${isPending ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {isPending ? "Pending" : "Cleared ✓"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={`font-bold text-sm ${isGiven ? "text-red-600" : "text-blue-600"}`}>{fmt(c.amount)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isPending && (
                              <button onClick={() => onMarkPaid(c.id)} title="Mark as paid"
                                className="h-6 w-6 rounded text-green-600 hover:bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => onDelete(c.id)} title="Delete"
                              className="h-6 w-6 rounded text-red-400 hover:bg-red-100 flex items-center justify-center">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  } else {
                    const e = item.data;
                    const isPayment = !e.isCredit && e.type === "cash_in";
                    return (
                      <tr key={`e-${e.id}`} className={`${rowBg} border-b hover:bg-green-50/30 transition-colors`}>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {format(item.date, "dd MMM yyyy")}<br />
                          <span className="text-[10px]">{format(item.date, "h:mm a")}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${isPayment ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                            {isPayment ? "Payment Received" : e.type === "cash_in" ? "Cash In" : "Cash Out"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {e.description || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${e.paymentMethod === "digital" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                            {e.paymentMethod === "digital" ? "Digital" : "Cash"}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge className="text-[10px] px-2 py-0.5 border-0 bg-green-100 text-green-700">Received ✓</Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="font-bold text-sm text-green-700">+{fmt(e.amount)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center"><span className="text-slate-300 text-xs">—</span></td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Supplier Detail Dialog ────────────────────────────────────────────────────
function SupplierDetailDialog({
  supplierName, credits, ledgerEntries, open, onClose,
  onMarkPaid, onDelete, onPay,
}: {
  supplierName: string; credits: Credit[]; ledgerEntries: LedgerEntry[];
  open: boolean; onClose: () => void;
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
  onPay: (name: string, amount: number, method: "cash" | "digital") => void;
}) {
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"cash" | "digital">("cash");
  const [showPay, setShowPay] = useState(false);

  const remaining = credits.filter(c => c.type === "received" && c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const paid = ledgerEntries.filter(e => !e.isCredit && e.type === "cash_out").reduce((s, e) => s + e.amount, 0);
  const phone = credits.find(c => c.phone)?.phone;

  type TimelineItem = { kind: "credit"; data: Credit; date: Date } | { kind: "entry"; data: LedgerEntry; date: Date };
  const timeline: TimelineItem[] = [
    ...credits.filter(c => !c.description?.includes("payment adjustment for entry #")).map(c => ({ kind: "credit" as const, data: c, date: new Date(c.createdAt) })),
    ...ledgerEntries.map(e => ({ kind: "entry" as const, data: e, date: new Date(e.entryDate) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
  const printableRows = statementRows(credits, ledgerEntries, "supplier");

  function handlePay() {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    onPay(supplierName, amt, payMethod);
    setPayAmount("");
    setShowPay(false);
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-4xl sm:w-[95vw] sm:max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-900 text-white px-5 py-4 rounded-t-lg flex-shrink-0">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
              remaining > 0 ? "bg-amber-500" : "bg-green-500"
            }`}>
              {supplierName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-lg">{supplierName}</p>
              {phone && <p className="text-xs text-blue-300 flex items-center gap-1.5 mt-0.5"><Phone className="h-3 w-3" />{phone}</p>}
              <p className="text-[11px] text-blue-300 mt-0.5">Supplier / Purchase Credit</p>
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button title="Download PDF" onClick={() => downloadCreditStatement(supplierName, "supplier", remaining, printableRows)}
                className="h-8 w-8 sm:w-auto sm:px-2 rounded border border-blue-700 text-blue-100 hover:bg-blue-800 flex items-center justify-center gap-1 text-xs"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span></button>
              <button title="Print statement" onClick={() => printCreditStatement(supplierName, "supplier", remaining, printableRows)}
                className="h-8 w-8 sm:w-auto sm:px-2 rounded border border-blue-700 text-blue-100 hover:bg-blue-800 flex items-center justify-center gap-1 text-xs"><Printer className="h-3.5 w-3.5" /><span className="hidden sm:inline">Print</span></button>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-blue-300">You Owe</p>
                <p className={`text-xl font-bold ${remaining > 0 ? "text-amber-300" : "text-green-300"}`}>{fmt(remaining)}</p>
              </div>
              <button onClick={onClose} className="text-blue-300 hover:text-white ml-1 sm:ml-2"><X className="h-5 w-5" /></button>
            </div>
          </div>
        </div>

        {/* Summary + Pay */}
        <div className="px-3 sm:px-5 py-3 border-b bg-blue-50 flex-shrink-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">You Owe</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{fmt(remaining)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-wide">Paid</p>
              <p className="text-lg font-bold text-green-700 mt-0.5">{fmt(paid)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Transactions</p>
              <p className="text-lg font-bold text-slate-700 mt-0.5">{timeline.length}</p>
            </div>
          </div>

          {remaining > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => { setShowPay(v => !v); setPayAmount(String(remaining)); }}
                className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl px-4 py-2.5 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <ArrowUpCircle className="h-4 w-4" /> Pay Supplier
                </span>
                <span className="text-sm font-bold text-amber-700">{fmt(remaining)}</span>
              </button>
              {showPay && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button onClick={() => setPayAmount(String(Math.round(remaining / 2)))}
                      className="h-8 text-xs border border-amber-200 rounded-lg bg-white hover:bg-amber-50 font-medium">
                      Half — {fmt(Math.round(remaining / 2))}
                    </button>
                    <button onClick={() => setPayAmount(String(remaining))}
                      className="h-8 text-xs border border-amber-300 rounded-lg bg-white hover:bg-amber-50 font-medium text-amber-700">
                      Full — {fmt(remaining)}
                    </button>
                    <Input type="number" placeholder="Custom amount..." value={payAmount}
                      onChange={e => setPayAmount(e.target.value)} className="h-8 text-sm font-bold bg-white" />
                  </div>
                  {parseFloat(payAmount) > 0 && parseFloat(payAmount) < remaining && (
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                      Partial payment — Remaining after this: <strong>{fmt(remaining - parseFloat(payAmount))}</strong>
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:flex gap-2">
                    {(["cash", "digital"] as const).map(m => (
                      <button key={m} onClick={() => setPayMethod(m)}
                        className={`flex items-center gap-2 justify-center border rounded-xl px-4 py-2 text-sm font-medium transition-colors flex-1 ${
                          payMethod === m
                            ? m === "cash" ? "bg-primary text-primary-foreground border-primary" : "bg-blue-600 text-white border-blue-600"
                            : "bg-white hover:bg-accent"
                        }`}>
                        {m === "cash" ? <Banknote className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                        {m === "cash" ? "Cash" : "Digital"}
                      </button>
                    ))}
                    <Button onClick={handlePay} disabled={!parseFloat(payAmount) || parseFloat(payAmount) <= 0}
                      className="col-span-2 sm:col-span-1 flex-1 bg-amber-600 hover:bg-amber-700 h-10">
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Confirm {payAmount ? fmt(parseFloat(payAmount)) : ""}
                    </Button>
                    <Button variant="ghost" className="col-span-2 sm:col-span-1 h-10 px-3" onClick={() => setShowPay(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction Table */}
        <div className="flex-1 overflow-auto">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide px-5 py-2 border-b bg-white sticky top-0">
            Transaction History — {timeline.length} records
          </p>
          {timeline.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">No transactions found</div>
          ) : (
            <table className="w-full min-w-[760px] text-sm border-collapse">
              <thead className="sticky top-8 z-10">
                <tr className="bg-slate-100 text-slate-600 text-xs border-b">
                  <th className="py-2 px-4 text-left font-semibold w-[140px]">Date & Time</th>
                  <th className="py-2 px-4 text-left font-semibold w-[130px]">Type</th>
                  <th className="py-2 px-4 text-left font-semibold">Description</th>
                  <th className="py-2 px-4 text-center font-semibold w-[80px]">Method</th>
                  <th className="py-2 px-4 text-center font-semibold w-[90px]">Status</th>
                  <th className="py-2 px-4 text-right font-semibold w-[110px]">Amount</th>
                  <th className="py-2 px-3 text-center font-semibold w-[70px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((item, idx) => {
                  const rowBg = idx % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                  if (item.kind === "credit") {
                    const c = item.data;
                    const isPending = c.status === "pending";
                    return (
                      <tr key={`c-${c.id}`} className={`${rowBg} border-b hover:bg-amber-50/30 transition-colors`}>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {format(item.date, "dd MMM yyyy")}<br />
                          <span className="text-[10px]">{format(item.date, "h:mm a")}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge className="text-[10px] px-2 py-0.5 border-0 font-semibold bg-amber-100 text-amber-700">
                            Purchase Credit
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {c.description || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center"><span className="text-xs text-muted-foreground">—</span></td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 ${isPending ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {isPending ? "Pending" : "Cleared ✓"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="font-bold text-sm text-amber-700">{fmt(c.amount)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isPending && (
                              <button onClick={() => onMarkPaid(c.id)} title="Mark as settled"
                                className="h-6 w-6 rounded text-green-600 hover:bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => onDelete(c.id)} title="Delete"
                              className="h-6 w-6 rounded text-red-400 hover:bg-red-100 flex items-center justify-center">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  } else {
                    const e = item.data;
                    const isPayment = !e.isCredit && e.type === "cash_out";
                    return (
                      <tr key={`e-${e.id}`} className={`${rowBg} border-b hover:bg-green-50/30 transition-colors`}>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                          {format(item.date, "dd MMM yyyy")}<br />
                          <span className="text-[10px]">{format(item.date, "h:mm a")}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${isPayment ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                            {isPayment ? "Payment Made" : "Cash Entry"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">
                          {e.description || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${e.paymentMethod === "digital" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                            {e.paymentMethod === "digital" ? "Digital" : "Cash"}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge className="text-[10px] px-2 py-0.5 border-0 bg-green-100 text-green-700">Paid ✓</Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className="font-bold text-sm text-green-700">-{fmt(e.amount)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center"><span className="text-slate-300 text-xs">—</span></td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Credit Dialog ─────────────────────────────────────────────────────────
function AddCreditDialog({ open, onClose, onSubmit, isPending, customers, defaultType }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: { customerName: string; phone: string; amount: number; description: string; type: "given" | "received"; dueDate: string }) => void;
  isPending: boolean; customers: any[]; defaultType?: "given" | "received";
}) {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"given" | "received">(defaultType ?? "given");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) { setCustomerName(""); setPhone(""); setAmount(""); setDescription(""); setType(defaultType ?? "given"); setDueDate(""); }
  }, [open, defaultType]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !amount) return;
    onSubmit({ customerName: customerName.trim(), phone, amount: parseFloat(amount), description, type, dueDate });
  }

  const isSupplier = type === "received";

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Credit Entry</DialogTitle>
          <DialogDescription>
            {isSupplier ? "Record a purchase or supplier credit (you owe them)" : "Record credit given to a customer (they owe you)"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType("given")}
              className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${type === "given" ? "bg-red-500 text-white border-red-500" : "bg-card hover:border-red-300 text-muted-foreground"}`}>
              🔴 Customer Credit
            </button>
            <button type="button" onClick={() => setType("received")}
              className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${type === "received" ? "bg-blue-500 text-white border-blue-500" : "bg-card hover:border-blue-300 text-muted-foreground"}`}>
              🔵 Supplier Credit
            </button>
          </div>
          <div>
            <label className="text-xs font-medium">{isSupplier ? "Supplier / Seller Name *" : "Customer Name *"}</label>
            <Input className="mt-1 h-9" placeholder={isSupplier ? "Supplier name..." : "Customer name..."} value={customerName}
              onChange={e => setCustomerName(e.target.value)} list="add-credit-suggestions" required />
            <datalist id="add-credit-suggestions">
              {customers.map((c: any) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Phone</label>
              <Input className="mt-1 h-9" placeholder="03xx..." value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Amount *</label>
              <Input type="number" className="mt-1 h-9" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} required min={1} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <Input className="mt-1 h-9" placeholder={isSupplier ? "e.g. Product purchase, Mobile purchase..." : "Optional note..."} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Due Date (optional)</label>
            <Input type="date" className="mt-1 h-9" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
            <Button type="submit" className={`flex-1 h-9 ${type === "given" ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"} text-white`} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Credits Page ─────────────────────────────────────────────────────────
export default function Credits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { document.title = "Credits - LedgerEntries"; }, []);

  const { data: credits = [], isLoading } = useListCredits();
  const { data: customers = [] } = useListCustomers({});
  const createCredit = useCreateCredit();
  const updateCredit = useUpdateCredit();
  const deleteCredit = useDeleteCredit();
  const createEntry = useCreateEntry();
  const { data: allCustomerEntries = [] } = useListEntries({ has_customer: true });

  const [activeTab, setActiveTab] = useState<"customer" | "supplier">("customer");
  const [searchName, setSearchName] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListCreditsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
  };

  // Split credits by type
  const customerCredits = credits.filter(c => c.type === "given");
  const supplierCredits = credits.filter(c => c.type === "received");

  // Group customer (given) credits by name
  const customerMap = new Map<string, Credit[]>();
  for (const c of customerCredits) {
    const key = c.customerName.trim().toLowerCase();
    const existing = [...customerMap.keys()].find(k => k.toLowerCase() === key);
    if (existing) customerMap.get(existing)!.push(c);
    else customerMap.set(c.customerName.trim(), [c]);
  }

  // Group supplier (received) credits by name
  const supplierMap = new Map<string, Credit[]>();
  for (const c of supplierCredits) {
    const key = c.customerName.trim().toLowerCase();
    const existing = [...supplierMap.keys()].find(k => k.toLowerCase() === key);
    if (existing) supplierMap.get(existing)!.push(c);
    else supplierMap.set(c.customerName.trim(), [c]);
  }

  // Group ledger entries by name
  const entriesMap = new Map<string, LedgerEntry[]>();
  for (const e of allCustomerEntries as LedgerEntry[]) {
    if (!e.customerName) continue;
    const key = e.customerName.trim().toLowerCase();
    const existing = [...entriesMap.keys()].find(k => k.toLowerCase() === key);
    if (existing) entriesMap.get(existing)!.push(e);
    else entriesMap.set(e.customerName.trim(), [e]);
  }

  // Build customer rows (customers who owe you)
  const customerRows = [...customerMap.entries()].map(([name, crds]) => {
    const phone = crds.find(c => c.phone)?.phone ?? "";
    const baqi = crds.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
    const wasool = (() => {
      const match = [...entriesMap.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase());
      return match ? match[1].filter(e => !e.isCredit && e.type === "cash_in").reduce((s, e) => s + e.amount, 0) : 0;
    })();
    const lastDate = crds.reduce((latest, c) => new Date(c.createdAt) > latest ? new Date(c.createdAt) : latest, new Date(0));
    const pendingCount = crds.filter(c => c.status === "pending" && c.amount > 0).length;
    return { name, phone, baqi, wasool, lastDate, pendingCount, crds };
  });

  // Build supplier rows (suppliers you owe)
  const supplierRows = [...supplierMap.entries()].map(([name, crds]) => {
    const phone = crds.find(c => c.phone)?.phone ?? "";
    const remaining = crds.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
    const paid = (() => {
      const match = [...entriesMap.entries()].find(([k]) => k.toLowerCase() === name.toLowerCase());
      return match ? match[1].filter(e => !e.isCredit && e.type === "cash_out").reduce((s, e) => s + e.amount, 0) : 0;
    })();
    const lastDate = crds.reduce((latest, c) => new Date(c.createdAt) > latest ? new Date(c.createdAt) : latest, new Date(0));
    const pendingCount = crds.filter(c => c.status === "pending" && c.amount > 0).length;
    return { name, phone, remaining, paid, lastDate, pendingCount, crds };
  });

  // Filter
  const filteredCustomers = customerRows
    .filter(r => {
      if (searchName && !r.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchPhone && !r.phone.includes(searchPhone)) return false;
      return true;
    })
    .sort((a, b) => b.baqi - a.baqi);

  const filteredSuppliers = supplierRows
    .filter(r => {
      if (searchName && !r.name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (searchPhone && !r.phone.includes(searchPhone)) return false;
      return true;
    })
    .sort((a, b) => b.remaining - a.remaining);

  // Grand totals
  const grandCustomerBalance = customerRows.reduce((s, r) => s + r.baqi, 0);
  const grandCustomerCollected = customerRows.reduce((s, r) => s + r.wasool, 0);
  const grandSupplierOwed = supplierRows.reduce((s, r) => s + r.remaining, 0);
  const grandSupplierPaid = supplierRows.reduce((s, r) => s + r.paid, 0);

  function handleAddCredit(data: any) {
    createCredit.mutate({ data: {
      customerName: data.customerName,
      phone: data.phone || null,
      amount: data.amount,
      description: data.description || null,
      type: data.type,
      dueDate: data.dueDate || null,
    }}, {
      onSuccess: () => { invalidateAll(); setDialogOpen(false); toast({ title: "Credit entry added" }); },
      onError: (e: any) => toast({ title: "Error", description: e.error, variant: "destructive" }),
    });
  }

  function handleMarkPaid(id: number) {
    updateCredit.mutate({ id, data: { status: "paid" } }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Marked as paid" }); },
    });
  }

  function handleDelete(id: number) {
    deleteCredit.mutate({ id }, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Moved to Recycle Bin" });
      },
    });
  }

  // Customer collects payment (cash_in)
  function handleCollect(name: string, amount: number, paymentMethod: "cash" | "digital") {
    createEntry.mutate({ data: {
      type: "cash_in", amount,
      description: `Payment received from ${name}`,
      paymentMethod, isCredit: false, customerName: name,
    }}, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Payment collected!", description: `${fmt(amount)} received from ${name}` });
      },
      onError: (e: any) => toast({ title: "Error", description: e.error, variant: "destructive" }),
    });
  }

  // Supplier payment (cash_out)
  function handlePaySupplier(name: string, amount: number, paymentMethod: "cash" | "digital") {
    createEntry.mutate({ data: {
      type: "cash_out", amount,
      description: `Payment to supplier ${name}`,
      paymentMethod, isCredit: false, customerName: name,
    }}, {
      onSuccess: () => {
        invalidateAll();
        toast({ title: "Supplier paid!", description: `${fmt(amount)} paid to ${name}` });
      },
      onError: (e: any) => toast({ title: "Error", description: e.error, variant: "destructive" }),
    });
  }

  // Selected rows
  const selCustomerRow = selectedCustomer ? customerRows.find(r => r.name.toLowerCase() === selectedCustomer.toLowerCase()) : null;
  const selCustomerCredits = selCustomerRow?.crds ?? [];
  const selCustomerEntries = (() => {
    if (!selectedCustomer) return [];
    const match = [...entriesMap.entries()].find(([k]) => k.toLowerCase() === selectedCustomer.toLowerCase());
    return match ? match[1] : [];
  })();

  const selSupplierRow = selectedSupplier ? supplierRows.find(r => r.name.toLowerCase() === selectedSupplier.toLowerCase()) : null;
  const selSupplierCredits = selSupplierRow?.crds ?? [];
  const selSupplierEntries = (() => {
    if (!selectedSupplier) return [];
    const match = [...entriesMap.entries()].find(([k]) => k.toLowerCase() === selectedSupplier.toLowerCase());
    return match ? match[1] : [];
  })();

  const isCustomerTab = activeTab === "customer";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b bg-card shrink-0">
        <Users className="h-5 w-5 text-teal-600" />
        <h1 className="font-bold text-base">Credits</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => setDialogOpen(true)}
            className={`h-8 text-white ${isCustomerTab ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700"}`}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            <span className="sm:hidden">New Credit</span>
            <span className="hidden sm:inline">{isCustomerTab ? "New Customer Credit" : "New Supplier Credit"}</span>
          </Button>
        </div>
      </div>

      {/* ── Overall summary bar ── */}
      <div className="grid grid-cols-2 gap-0 border-b shrink-0">
        <div className="flex items-center gap-3 px-4 py-2 bg-red-50 border-r">
          <Users className="h-4 w-4 text-red-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-wide">Customers Owe You</p>
            <p className="text-base font-bold text-red-700">{fmt(grandCustomerBalance)}</p>
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">Collected: <span className="font-semibold text-green-700">{fmt(grandCustomerCollected)}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50">
          <Building2 className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">You Owe Suppliers</p>
            <p className="text-base font-bold text-amber-700">{fmt(grandSupplierOwed)}</p>
          </div>
          <div className="ml-auto text-right hidden sm:block">
            <p className="text-[10px] text-muted-foreground">Paid: <span className="font-semibold text-green-700">{fmt(grandSupplierPaid)}</span></p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b shrink-0 bg-card">
        <button
          onClick={() => { setActiveTab("customer"); setSearchName(""); setSearchPhone(""); }}
          className={`flex-1 justify-center flex items-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
            isCustomerTab ? "border-teal-600 text-teal-700" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Customer Credits
          {grandCustomerBalance > 0 && (
            <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
              {customerRows.filter(r => r.baqi > 0).length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab("supplier"); setSearchName(""); setSearchPhone(""); }}
          className={`flex-1 justify-center flex items-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
            !isCustomerTab ? "border-blue-600 text-blue-700" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Supplier Credits
          {grandSupplierOwed > 0 && (
            <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
              {supplierRows.filter(r => r.remaining > 0).length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab summary bar ── */}
      {isCustomerTab ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 sm:px-4 py-1.5 border-b bg-muted/10 shrink-0 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Collected:</span>
            <span className="font-bold text-green-700">{fmt(grandCustomerCollected)}</span>
          </div>
          <div className="w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Balance Due:</span>
            <span className="font-bold text-red-600">{fmt(grandCustomerBalance)}</span>
          </div>
          <div className="w-full sm:w-auto sm:ml-auto text-xs text-muted-foreground">{filteredCustomers.length} customers</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 sm:px-4 py-1.5 border-b bg-muted/10 shrink-0 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Paid to Suppliers:</span>
            <span className="font-bold text-green-700">{fmt(grandSupplierPaid)}</span>
          </div>
          <div className="w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">You Still Owe:</span>
            <span className="font-bold text-amber-700">{fmt(grandSupplierOwed)}</span>
          </div>
          <div className="w-full sm:w-auto sm:ml-auto text-xs text-muted-foreground">{filteredSuppliers.length} suppliers</div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem_auto] gap-2 px-3 sm:px-4 py-2 border-b bg-muted/5 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder={isCustomerTab ? "Search by customer name..." : "Search by supplier name..."}
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
          />
        </div>
        <div className="relative w-full sm:w-44">
          <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-teal-400"
            placeholder="Phone number..."
            value={searchPhone}
            onChange={e => setSearchPhone(e.target.value)}
          />
        </div>
        {(searchName || searchPhone) && (
          <button onClick={() => { setSearchName(""); setSearchPhone(""); }}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500 border rounded-md hover:border-red-300 transition-colors flex items-center gap-1">
            <X className="h-3.5 w-3.5" />Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">Loading...</div>
        ) : isCustomerTab ? (
          /* ── Customer Credits Table ── */
          filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Users className="h-14 w-14 opacity-20" />
              <p className="font-medium">{searchName || searchPhone ? "No customer found" : "No customer credits yet"}</p>
              {!searchName && !searchPhone && (
                <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Customer Credit
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse" style={{ minWidth: "700px" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white text-xs">
                  <th className="py-2 px-2 text-center font-medium w-9 border-r border-slate-700">#</th>
                  <th className="py-2 px-3 text-left font-medium border-r border-slate-700" style={{ minWidth: "160px" }}>Customer Name</th>
                  <th className="py-2 px-3 text-left font-medium w-[130px] border-r border-slate-700">Phone</th>
                  <th className="py-2 px-3 text-right font-medium w-[110px] border-r border-slate-700">Collected</th>
                   <th className="py-2 px-3 text-right font-medium w-[120px] border-r border-slate-700">Remaining</th>
                  <th className="py-2 px-3 text-center font-medium w-[100px] border-r border-slate-700">Last Date</th>
                  <th className="py-2 px-3 text-center font-medium w-[80px] border-r border-slate-700">Status</th>
                  <th className="py-2 px-3 text-center font-medium w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((row, idx) => {
                  const hasPending = row.baqi > 0;
                  const rowBg = hasPending
                    ? idx % 2 === 0 ? "bg-red-50/40" : "bg-white"
                    : idx % 2 === 0 ? "bg-gray-50" : "bg-white";
                  return (
                    <tr key={row.name} className={`border-b ${rowBg} hover:bg-blue-50/40 transition-colors`}>
                      <td className="py-1.5 px-2 text-center text-xs text-muted-foreground font-medium border-r">{idx + 1}</td>
                      <td className="py-1.5 px-3 border-r">
                        <button onClick={() => setSelectedCustomer(row.name)} className="flex items-center gap-2 group text-left w-full">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${hasPending ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-sm group-hover:text-teal-600 group-hover:underline transition-colors">{row.name}</span>
                            {row.pendingCount > 0 && (
                              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-medium">{row.pendingCount} pending</span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-teal-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="py-1.5 px-3 border-r">
                        {row.phone ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{row.phone}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right border-r">
                        {row.wasool > 0 ? <span className="text-sm font-semibold text-green-700">{fmt(row.wasool)}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right border-r">
                        {row.baqi > 0 ? <span className="text-sm font-bold text-red-600">{fmt(row.baqi)}</span> : <span className="text-xs text-green-600 font-semibold">Cleared ✓</span>}
                      </td>
                      <td className="py-1.5 px-3 text-center border-r"><span className="text-xs text-muted-foreground">{fmtDate(row.lastDate.toISOString())}</span></td>
                      <td className="py-1.5 px-3 text-center border-r">
                        {hasPending ? <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Pending</Badge> : <Badge className="text-[10px] bg-green-100 text-green-700 border-0">Cleared</Badge>}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {row.baqi > 0 && (
                            <button onClick={() => setSelectedCustomer(row.name)}
                              className="h-7 px-2 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                              Collect
                            </button>
                          )}
                          <button onClick={() => setSelectedCustomer(row.name)}
                            className="h-7 w-7 rounded text-muted-foreground hover:text-teal-600 hover:bg-teal-50 flex items-center justify-center transition-colors">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredCustomers.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300 sticky bottom-0">
                    <td colSpan={3} className="py-2 px-3 text-xs text-muted-foreground border-r">Total — {filteredCustomers.length} customers</td>
                    <td className="py-2 px-3 text-right text-sm text-green-700 border-r">{fmt(filteredCustomers.reduce((s, r) => s + r.wasool, 0))}</td>
                    <td className="py-2 px-3 text-right text-sm text-red-600 border-r font-bold">{fmt(filteredCustomers.reduce((s, r) => s + r.baqi, 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          )
        ) : (
          /* ── Supplier Credits Table ── */
          filteredSuppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Building2 className="h-14 w-14 opacity-20" />
              <p className="font-medium">{searchName || searchPhone ? "No supplier found" : "No supplier credits yet"}</p>
              <p className="text-xs text-center max-w-xs">Purchase on credit or add a mobile purchase on credit — it will appear here.</p>
              {!searchName && !searchPhone && (
                <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Supplier Credit
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse" style={{ minWidth: "700px" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-blue-900 text-white text-xs">
                  <th className="py-2 px-2 text-center font-medium w-9 border-r border-blue-800">#</th>
                  <th className="py-2 px-3 text-left font-medium border-r border-blue-800" style={{ minWidth: "160px" }}>Supplier / Seller</th>
                  <th className="py-2 px-3 text-left font-medium w-[130px] border-r border-blue-800">Phone</th>
                  <th className="py-2 px-3 text-right font-medium w-[110px] border-r border-blue-800">Paid</th>
                   <th className="py-2 px-3 text-right font-medium w-[120px] border-r border-blue-800">Remaining</th>
                  <th className="py-2 px-3 text-center font-medium w-[100px] border-r border-blue-800">Last Date</th>
                  <th className="py-2 px-3 text-center font-medium w-[80px] border-r border-blue-800">Status</th>
                  <th className="py-2 px-3 text-center font-medium w-[90px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((row, idx) => {
                  const hasDebt = row.remaining > 0;
                  const rowBg = hasDebt
                    ? idx % 2 === 0 ? "bg-amber-50/40" : "bg-white"
                    : idx % 2 === 0 ? "bg-gray-50" : "bg-white";
                  return (
                    <tr key={row.name} className={`border-b ${rowBg} hover:bg-blue-50/40 transition-colors`}>
                      <td className="py-1.5 px-2 text-center text-xs text-muted-foreground font-medium border-r">{idx + 1}</td>
                      <td className="py-1.5 px-3 border-r">
                        <button onClick={() => setSelectedSupplier(row.name)} className="flex items-center gap-2 group text-left w-full">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${hasDebt ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-sm group-hover:text-blue-600 group-hover:underline transition-colors">{row.name}</span>
                            {row.pendingCount > 0 && (
                              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-medium">{row.pendingCount} pending</span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                      <td className="py-1.5 px-3 border-r">
                        {row.phone ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{row.phone}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right border-r">
                        {row.paid > 0 ? <span className="text-sm font-semibold text-green-700">{fmt(row.paid)}</span> : <span className="text-xs text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right border-r">
                        {hasDebt ? <span className="text-sm font-bold text-amber-700">{fmt(row.remaining)}</span> : <span className="text-xs text-green-600 font-semibold">Settled ✓</span>}
                      </td>
                      <td className="py-1.5 px-3 text-center border-r"><span className="text-xs text-muted-foreground">{fmtDate(row.lastDate.toISOString())}</span></td>
                      <td className="py-1.5 px-3 text-center border-r">
                        {hasDebt ? <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Pending</Badge> : <Badge className="text-[10px] bg-green-100 text-green-700 border-0">Settled</Badge>}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {hasDebt && (
                            <button onClick={() => setSelectedSupplier(row.name)}
                              className="h-7 px-2 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                              Pay
                            </button>
                          )}
                          <button onClick={() => setSelectedSupplier(row.name)}
                            className="h-7 w-7 rounded text-muted-foreground hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredSuppliers.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200 sticky bottom-0">
                    <td colSpan={3} className="py-2 px-3 text-xs text-muted-foreground border-r">Total — {filteredSuppliers.length} suppliers</td>
                    <td className="py-2 px-3 text-right text-sm text-green-700 border-r">{fmt(filteredSuppliers.reduce((s, r) => s + r.paid, 0))}</td>
                    <td className="py-2 px-3 text-right text-sm text-amber-700 border-r font-bold">{fmt(filteredSuppliers.reduce((s, r) => s + r.remaining, 0))}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          )
        )}
      </div>

      {/* ── Customer Detail Dialog ── */}
      {selectedCustomer && (
        <CustomerDetailDialog
          customerName={selectedCustomer}
          credits={selCustomerCredits}
          ledgerEntries={selCustomerEntries}
          open={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onMarkPaid={handleMarkPaid}
          onDelete={handleDelete}
          onCollect={handleCollect}
        />
      )}

      {/* ── Supplier Detail Dialog ── */}
      {selectedSupplier && (
        <SupplierDetailDialog
          supplierName={selectedSupplier}
          credits={selSupplierCredits}
          ledgerEntries={selSupplierEntries}
          open={!!selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onMarkPaid={handleMarkPaid}
          onDelete={handleDelete}
          onPay={handlePaySupplier}
        />
      )}

      {/* ── Add Credit Dialog ── */}
      <AddCreditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddCredit}
        isPending={createCredit.isPending}
        customers={customers}
        defaultType={isCustomerTab ? "given" : "received"}
      />
    </div>
  );
}
