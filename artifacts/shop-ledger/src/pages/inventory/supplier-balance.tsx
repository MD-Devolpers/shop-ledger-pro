import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetSupplierBalance, useListSupplierPayments, useCreateSupplierPayment,
  useDeleteSupplierPayment, useListCompanies, type SupplierBalance,
} from "@/lib/inventory-api";
import { Building2, Plus, Trash2, CreditCard, ChevronDown, ChevronRight, Banknote, Smartphone } from "lucide-react";

function fmt(n: number) { return "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-PK"); }

const EMPTY_FORM = { companyId: "", amount: "", paymentDate: new Date().toISOString().split("T")[0], notes: "", paymentMethod: "cash", billId: "" };

export default function SupplierBalancePage() {
  const { toast } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);
  const [payForm, setPayForm] = useState(EMPTY_FORM);

  const { data: balances = [], isLoading } = useGetSupplierBalance();
  const { data: companies = [] } = useListCompanies();
  const { data: payments = [] } = useListSupplierPayments(expandedCompany ?? undefined);
  const createPayment = useCreateSupplierPayment();
  const deletePayment = useDeleteSupplierPayment();

  const totalPurchase = balances.reduce((s, b) => s + b.totalPurchase, 0);
  const totalPaid = balances.reduce((s, b) => s + b.paidAmount, 0);
  const totalRemaining = balances.reduce((s, b) => s + b.remainingBalance, 0);

  async function handlePay() {
    if (!payForm.companyId || !payForm.amount || !payForm.paymentDate) {
      toast({ title: "Company, amount and date are required", variant: "destructive" }); return;
    }
    createPayment.mutate({
      companyId: parseInt(payForm.companyId),
      amount: parseFloat(payForm.amount),
      paymentDate: payForm.paymentDate,
      notes: payForm.notes || undefined,
      paymentMethod: payForm.paymentMethod as "cash" | "digital",
      billId: payForm.billId ? parseInt(payForm.billId) : undefined,
    } as any, {
      onSuccess: () => { toast({ title: "Payment recorded" }); setPayOpen(false); setPayForm(EMPTY_FORM); },
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supplier Credit</h1>
          <p className="text-muted-foreground text-sm">Credit purchases — outstanding amount per supplier</p>
        </div>
        <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-1" />Payment Record</Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Purchased</p>
          <p className="text-lg font-bold">{fmt(totalPurchase)}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-xs text-green-700">Total Paid</p>
          <p className="text-lg font-bold text-green-700">{fmt(totalPaid)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-xs text-red-700">Balance Remaining</p>
          <p className="text-lg font-bold text-red-700">{fmt(totalRemaining)}</p>
        </div>
      </div>

      {/* Supplier list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />)}</div>
      ) : balances.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No suppliers found</p>
          <p className="text-sm">Add companies and link them to purchase bills</p>
        </div>
      ) : (
        <div className="space-y-2">
          {balances.map(b => (
            <div key={b.companyId} className="bg-card border rounded-xl overflow-hidden">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCompany(expandedCompany === b.companyId ? null : b.companyId)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{b.companyName}</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-muted-foreground">Purchased: <span className="text-foreground font-medium">{fmt(b.totalPurchase)}</span></span>
                    <span className="text-green-600">Paid: <span className="font-medium">{fmt(b.paidAmount)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className={`font-bold ${b.remainingBalance > 0 ? "text-red-600" : "text-green-600"}`}>{fmt(b.remainingBalance)}</p>
                  </div>
                  {expandedCompany === b.companyId ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {expandedCompany === b.companyId && (
                <div className="border-t px-4 pb-4 pt-3 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-muted-foreground">Payment History</p>
                    <Button size="sm" variant="outline" onClick={() => { setPayForm(f => ({ ...f, companyId: String(b.companyId) })); setPayOpen(true); }}>
                      <CreditCard className="h-3.5 w-3.5 mr-1" />Pay
                    </Button>
                  </div>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No payment records found</p>
                  ) : (
                    payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          {p.paymentMethod === "digital"
                            ? <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                            : <Banknote className="h-3.5 w-3.5 text-green-600" />}
                          <div>
                            <span className="text-sm font-medium text-green-700">{fmt(p.amount)}</span>
                            {p.notes && <span className="text-xs text-muted-foreground ml-2">— {p.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs h-5 ${p.paymentMethod === "digital" ? "text-blue-600 border-blue-200" : "text-green-600 border-green-200"}`}>
                            {p.paymentMethod === "digital" ? "Digital" : "Cash"}
                          </Badge>
                          {p.billId && <Badge variant="secondary" className="text-xs h-5">Bill #{p.billId}</Badge>}
                          <span className="text-xs text-muted-foreground">{fmtDate(p.paymentDate)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => deletePayment.mutate(p.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Supplier Payment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Company *</label>
              <Select value={payForm.companyId} onValueChange={v => setPayForm(f => ({ ...f, companyId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Amount *</label>
                <Input type="number" className="mt-1" placeholder="0" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Date *</label>
                <Input type="date" className="mt-1" value={payForm.paymentDate} onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={payForm.paymentMethod} onValueChange={v => setPayForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">💵 Cash</SelectItem>
                  <SelectItem value="digital">📱 Digital (Online/Transfer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Bill Reference (optional)</label>
              <Input className="mt-1" placeholder="Bill ID (if paying for a specific bill)" type="number" value={payForm.billId} onChange={e => setPayForm(f => ({ ...f, billId: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input className="mt-1" placeholder="Payment notes..." value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Back</Button>
            <Button onClick={handlePay} disabled={createPayment.isPending}>{createPayment.isPending ? "Saving..." : "Payment Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
