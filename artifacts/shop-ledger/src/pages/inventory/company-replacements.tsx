import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useListReplacements, useCreateReplacement, useGetReplacement,
  useReceiveReplacement, useUpdateReplacement, useListProducts, useListCompanies,
  type CompanyReplacement,
} from "@/lib/inventory-api";
import { ArrowDownToLine, PackageX, Plus, ChevronRight, Filter, RotateCcw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  partially_received: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partially_received: "Partially Received",
  completed: "Completed",
  rejected: "Rejected",
};

function fmt(n: number) { return n.toLocaleString("en-PK"); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-PK"); }

export default function CompanyReplacements() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCompany, setFilterCompany] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { data: replacements = [], isLoading } = useListReplacements({ status: filterStatus !== "all" ? filterStatus : undefined });
  const { data: products = [] } = useListProducts();
  const { data: companies = [] } = useListCompanies();
  const { data: detailReplacement } = useGetReplacement(detailId);
  const createReplacement = useCreateReplacement();
  const receiveReplacement = useReceiveReplacement();
  const updateReplacement = useUpdateReplacement();

  // Create form state
  const [form, setForm] = useState({
    productId: "", companyId: "", companyName: "", sentQty: "",
    dateSent: new Date().toISOString().split("T")[0],
    faultReason: "", customerName: "", referenceNo: "", notes: "",
  });

  // Receive form state
  const [recvForm, setRecvForm] = useState({ receivedQty: "", receiveDate: new Date().toISOString().split("T")[0], notes: "" });

  const filtered = replacements.filter(r =>
    filterCompany ? r.companyName.toLowerCase().includes(filterCompany.toLowerCase()) : true
  );

  function handleCompanySelect(cid: string) {
    setForm(f => {
      const company = companies.find(c => String(c.id) === cid);
      return { ...f, companyId: cid, companyName: company?.name ?? "" };
    });
  }

  async function handleCreate() {
    if (!form.productId || !form.companyName || !form.sentQty || !form.faultReason) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    createReplacement.mutate({
      productId: parseInt(form.productId),
      companyId: form.companyId ? parseInt(form.companyId) : null,
      companyName: form.companyName,
      sentQty: parseFloat(form.sentQty),
      dateSent: form.dateSent,
      faultReason: form.faultReason,
      customerName: form.customerName || null,
      referenceNo: form.referenceNo || null,
      notes: form.notes || null,
    }, {
      onSuccess: () => { toast({ title: "Replacement created" }); setCreateOpen(false); setForm({ productId: "", companyId: "", companyName: "", sentQty: "", dateSent: new Date().toISOString().split("T")[0], faultReason: "", customerName: "", referenceNo: "", notes: "" }); },
      onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  }

  async function handleReceive() {
    if (!detailId || !recvForm.receivedQty) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    receiveReplacement.mutate({
      id: detailId,
      receivedQty: parseFloat(recvForm.receivedQty),
      receiveDate: recvForm.receiveDate,
      notes: recvForm.notes || undefined,
    }, {
      onSuccess: (r) => { toast({ title: `Received! Status: ${r.newStatus}` }); setReceiveOpen(false); setRecvForm({ receivedQty: "", receiveDate: new Date().toISOString().split("T")[0], notes: "" }); },
      onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  }

  async function handleReject(id: number) {
    updateReplacement.mutate({ id, status: "rejected" }, {
      onSuccess: () => toast({ title: "Marked as Rejected" }),
      onError: e => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Replacements</h1>
          <p className="text-muted-foreground text-sm">Track defective products sent for replacement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/inventory/bulk-replacement")}>
            <RotateCcw className="h-4 w-4 mr-1" />Bulk
          </Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />New</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search company..." className="pl-8 h-9 w-48" value={filterCompany} onChange={e => setFilterCompany(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partially_received">Partially Received</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["pending", "partially_received", "completed", "rejected"] as const).map(s => {
          const count = replacements.filter(r => r.status === s).length;
          return (
            <div key={s} className="bg-card border rounded-xl p-3 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterStatus(s)}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${s === "pending" ? "text-amber-600" : s === "partially_received" ? "text-blue-600" : s === "completed" ? "text-green-600" : "text-red-600"}`}>{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PackageX className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No replacements found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-50 dark:bg-teal-950/20">
                <th className="text-center py-2 px-2 border-b text-xs w-10">#</th>
                <th className="text-left py-2 px-2 border-b text-xs">Product</th>
                <th className="text-left py-2 px-2 border-b text-xs">Company</th>
                <th className="text-left py-2 px-2 border-b text-xs">Qty</th>
                <th className="text-left py-2 px-2 border-b text-xs">Date</th>
                <th className="text-left py-2 px-2 border-b text-xs">Status</th>
                <th className="text-right py-2 px-2 border-b text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className="border-b last:border-b-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => setDetailId(r.id)}
                >
                  <td className="text-center py-2 px-2 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{r.productName ?? "—"}</span>
                      {r.productCode && <span className="text-xs text-muted-foreground">({r.productCode})</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">Fault: {r.faultReason}</p>
                  </td>
                  <td className="py-2 px-2 text-xs">{r.companyName}</td>
                  <td className="py-2 px-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-muted-foreground">S: <span className="font-semibold text-foreground">{fmt(r.sentQty)}</span></span>
                      <span className="text-green-600">R: <span className="font-semibold">{fmt(r.receivedQty)}</span></span>
                      {r.pendingQty > 0 && <span className="text-amber-600">P: <span className="font-semibold">{fmt(r.pendingQty)}</span></span>}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.dateSent)}</td>
                  <td className="py-2 px-2">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</Badge>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={e => { e.stopPropagation(); setDetailId(r.id); }}
                      >
                        <ChevronRight className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Company Replacement</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">Product *</label>
              <Select value={form.productId} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Company *</label>
              <Select value={form.companyId} onValueChange={handleCompanySelect}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Enter manually...</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {(form.companyId === "manual" || !form.companyId) && (
                <Input className="mt-1" placeholder="Company name *" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Sent Qty *</label>
                <Input type="number" className="mt-1" value={form.sentQty} onChange={e => setForm(f => ({ ...f, sentQty: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Date Sent *</label>
                <Input type="date" className="mt-1" value={form.dateSent} onChange={e => setForm(f => ({ ...f, dateSent: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Fault/Reason *</label>
              <Textarea className="mt-1" rows={2} value={form.faultReason} onChange={e => setForm(f => ({ ...f, faultReason: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Customer Name</label>
                <Input className="mt-1" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Ref / Bill No</label>
                <Input className="mt-1" value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea className="mt-1" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createReplacement.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId} onOpenChange={open => { if (!open) { setDetailId(null); setReceiveOpen(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailReplacement ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailReplacement.productName}
                  <Badge variant="outline" className={`text-[10px] ml-1 ${STATUS_COLORS[detailReplacement.status]}`}>{STATUS_LABELS[detailReplacement.status]}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">Sent</p>
                    <p className="text-xl font-bold">{fmt(detailReplacement.sentQty)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-700">Received</p>
                    <p className="text-xl font-bold text-green-700">{fmt(detailReplacement.receivedQty)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-700">Pending</p>
                    <p className="text-xl font-bold text-amber-700">{fmt(detailReplacement.pendingQty)}</p>
                  </div>
                </div>

                {/* Info */}
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Company:</span><span className="font-medium">{detailReplacement.companyName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Sent On:</span><span>{fmtDate(detailReplacement.dateSent)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fault:</span><span className="text-right max-w-[60%]">{detailReplacement.faultReason}</span></div>
                  {detailReplacement.customerName && <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span><span>{detailReplacement.customerName}</span></div>}
                  {detailReplacement.referenceNo && <div className="flex justify-between"><span className="text-muted-foreground">Ref/Bill No:</span><span>{detailReplacement.referenceNo}</span></div>}
                </div>

                {/* Receive history */}
                {(detailReplacement.receives ?? []).length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Receive History</p>
                    <div className="space-y-1.5">
                      {(detailReplacement.receives ?? []).map((recv, i) => (
                        <div key={recv.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
                          <span className="text-green-700 font-medium">+{fmt(recv.receivedQty)} received</span>
                          <span className="text-muted-foreground text-xs">{fmtDate(recv.receiveDate)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Receive form */}
                {(detailReplacement.status === "pending" || detailReplacement.status === "partially_received") && (
                  <>
                    {!receiveOpen ? (
                      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setReceiveOpen(true)}>
                        <ArrowDownToLine className="h-4 w-4 mr-2" />Receive Replacement
                      </Button>
                    ) : (
                      <div className="border rounded-xl p-3 space-y-2 bg-green-50/50">
                        <p className="text-sm font-semibold text-green-800">Receive Replacement</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium">Received Qty *</label>
                            <Input type="number" className="mt-1 h-8" max={detailReplacement.pendingQty} value={recvForm.receivedQty} onChange={e => setRecvForm(f => ({ ...f, receivedQty: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs font-medium">Date *</label>
                            <Input type="date" className="mt-1 h-8" value={recvForm.receiveDate} onChange={e => setRecvForm(f => ({ ...f, receiveDate: e.target.value }))} />
                          </div>
                        </div>
                        <Input placeholder="Notes (optional)" value={recvForm.notes} onChange={e => setRecvForm(f => ({ ...f, notes: e.target.value }))} />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleReceive} disabled={receiveReplacement.isPending}>Confirm Receive</Button>
                          <Button size="sm" variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}
                    <Button variant="outline" className="w-full text-red-600 border-red-200" onClick={() => handleReject(detailReplacement.id)}>Mark as Rejected</Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
