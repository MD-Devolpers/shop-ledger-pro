import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useBulkCreateReplacement,
  useListCompanies,
  useListProducts,
  type Product,
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, RotateCcw, ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ReplacementRow {
  _id: string;
  code: string;
  productId: number | null;
  productName: string;
  sentQty: string;
  faultReason: string;
}

function newRow(): ReplacementRow {
  return {
    _id: Math.random().toString(36).slice(2),
    code: "", productId: null, productName: "", sentQty: "", faultReason: "",
  };
}

export default function BulkReplacement() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const bulkCreate = useBulkCreateReplacement();

  const { data: companies = [] } = useListCompanies();
  const { data: allProducts = [] } = useListProducts();

  // Header state
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [dateSent, setDateSent] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  // Rows
  const [rows, setRows] = useState<ReplacementRow[]>([newRow(), newRow(), newRow()]);

  const addRow = () => setRows(r => [...r, newRow()]);
  const removeRow = (id: string) => setRows(r => r.filter(x => x._id !== id));

  const updateRow = useCallback((id: string, field: keyof ReplacementRow, value: string) => {
    setRows(rows => rows.map(r => r._id === id ? { ...r, [field]: value } : r));
  }, []);

  // Lookup product by code on blur
  const lookupByCode = useCallback((rowId: string, code: string) => {
    if (!code.trim()) return;
    const found = allProducts.find(p => p.code.toLowerCase() === code.trim().toLowerCase());
    if (found) {
      setRows(rows => rows.map(r => r._id === rowId
        ? { ...r, code: found.code, productId: found.id, productName: found.name }
        : r));
    }
  }, [allProducts]);

  // Pick product from dropdown
  const pickProduct = useCallback((rowId: string, productId: string) => {
    const found = allProducts.find(p => p.id.toString() === productId);
    if (found) {
      setRows(rows => rows.map(r => r._id === rowId
        ? { ...r, productId: found.id, productName: found.name, code: found.code }
        : r));
    }
  }, [allProducts]);

  const validRows = rows.filter(r => (r.productId || r.code.trim()) && parseFloat(r.sentQty || "0") > 0 && r.faultReason.trim());
  const totalQty = validRows.reduce((s, r) => s + (parseFloat(r.sentQty) || 0), 0);

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast({ title: "Company name required", variant: "destructive" }); return;
    }
    if (validRows.length === 0) {
      toast({ title: "At least one valid row required (product + qty + fault reason)", variant: "destructive" }); return;
    }

    try {
      const result = await bulkCreate.mutateAsync({
        companyId: companyId || undefined,
        companyName: companyName.trim(),
        dateSent,
        notes: notes.trim() || undefined,
        items: validRows.map(r => ({
          code: r.code,
          productId: r.productId ?? undefined,
          sentQty: r.sentQty,
          faultReason: r.faultReason,
        })),
      });
      toast({
        title: `✅ ${result.count} replacement(s) submitted`,
        description: `Company: ${companyName} · Date: ${dateSent}`,
      });
      // Reset
      setCompanyId("");
      setCompanyName("");
      setDateSent(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
      setRows([newRow(), newRow(), newRow()]);
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory/company-replacements")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Bulk Replacement
          </h1>
          <p className="text-sm text-muted-foreground">Send multiple products to company for replacement</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/inventory/company-replacements")}>
          View Replacements
        </Button>
      </div>

      {/* Details Card */}
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Replacement Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Company (Master)</Label>
            <Select value={companyId || "none"} onValueChange={v => {
              if (v === "none") { setCompanyId(""); return; }
              setCompanyId(v);
              const c = companies.find(c => c.id.toString() === v);
              if (c) setCompanyName(c.name);
            }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select company..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Company Name <span className="text-red-500">*</span></Label>
            <Input
              className="h-9"
              placeholder="e.g. Samsung"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date Sent</Label>
            <Input type="date" className="h-9" value={dateSent} onChange={e => setDateSent(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (Optional)</Label>
            <Input className="h-9" placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div>
            <span className="font-semibold text-sm">Products to Replace</span>
            {validRows.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{validRows.length} valid</Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Row
          </Button>
        </div>

        <div className="px-4 py-2 bg-amber-50 border-b flex items-start gap-2 text-xs text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Enter product code or select from dropdown — product name will auto-fill. All rows need qty and fault reason.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="text-left py-3 px-3 w-9">#</th>
                <th className="text-left py-3 px-3 w-[120px]">Code</th>
                <th className="text-left py-3 px-3" style={{ minWidth: "200px" }}>Product</th>
                <th className="text-right py-3 px-3 w-[90px]">Qty <span className="text-red-500">*</span></th>
                <th className="text-left py-3 px-3" style={{ minWidth: "220px" }}>Fault Reason <span className="text-red-500">*</span></th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isValid = (row.productId || row.code.trim()) && parseFloat(row.sentQty || "0") > 0 && row.faultReason.trim();
                return (
                  <tr key={row._id} className={`border-b transition-colors ${isValid ? "bg-white dark:bg-background" : "bg-muted/5"} hover:bg-muted/10`}>
                    <td className="py-2 px-3 text-muted-foreground text-xs font-medium">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <Input
                        className="h-9 text-sm font-mono"
                        placeholder="CAB-001"
                        value={row.code}
                        onChange={e => updateRow(row._id, "code", e.target.value)}
                        onBlur={e => lookupByCode(row._id, e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-3">
                      {row.productName ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{row.productName}</span>
                          <button
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setRows(rows => rows.map(r => r._id === row._id ? { ...r, productId: null, productName: "", code: "" } : r))}
                          >✕</button>
                        </div>
                      ) : (
                        <Select onValueChange={v => pickProduct(row._id, v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select product..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allProducts.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name} <span className="text-xs text-muted-foreground ml-1">({p.code})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        className="h-9 text-sm text-right font-semibold"
                        type="number"
                        min="1"
                        placeholder="0"
                        value={row.sentQty}
                        onChange={e => updateRow(row._id, "sentQty", e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        className="h-9 text-sm"
                        placeholder="e.g. Screen cracked, charging issue..."
                        value={row.faultReason}
                        onChange={e => updateRow(row._id, "faultReason", e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {rows.length > 1 && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeRow(row._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t bg-muted/10">
          <Button variant="outline" size="sm" onClick={addRow} className="w-full sm:w-auto border-dashed">
            <Plus className="h-3.5 w-3.5 mr-1" />Add More Product
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="border rounded-xl p-4 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Valid Rows</p>
              <p className="text-2xl font-bold">{validRows.length}</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Total Qty Sent</p>
              <p className="text-2xl font-bold text-amber-700">{totalQty}</p>
            </div>
          </div>
          {companyName && (
            <p className="text-xs text-muted-foreground">
              Company: {companyName} · Date: {dateSent}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRows([newRow(), newRow(), newRow()]);
              setNotes("");
            }}
          >
            Clear
          </Button>
          <Button
            onClick={handleSave}
            disabled={bulkCreate.isPending || !companyName.trim() || validRows.length === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6"
          >
            {bulkCreate.isPending ? "Saving..." : (
              <span className="flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                Submit Replacements
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
