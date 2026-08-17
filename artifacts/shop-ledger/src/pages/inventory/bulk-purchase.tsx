import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  useBulkCreatePurchaseBill,
  useListCompanies,
  useListCategories,
  useListCollections,
  useListProducts,
  useCreateCompany,
  useCreateCategory,
  useCreateCollection,
  type BulkPurchaseRow,
} from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Save, ArrowLeft, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

type Row = BulkPurchaseRow & { _id: string; _productCompanyId?: string };

function newRow(companyId = ""): Row {
  return {
    _id: Math.random().toString(36).slice(2),
    code: "", name: "", companyId, categoryId: "", collectionId: "",
    purchasePrice: "", salePrice: "", quantity: "",
    minStockAlert: "0", expiryDate: "",
  };
}

// ── Quick-Add Dialog ────────────────────────────────────────────────────────
function QuickAddDialog({
  open, title, onClose, onSave,
}: { open: boolean; title: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim());
    setName("");
    setSaving(false);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader><DialogTitle>Add {title}</DialogTitle></DialogHeader>
        <Input
          autoFocus
          placeholder={`${title} name...`}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving || !name.trim()} onClick={handleSave}
            className="bg-teal-600 hover:bg-teal-700 text-white">
            {saving ? "Saving..." : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BulkPurchase() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const bulkCreate = useBulkCreatePurchaseBill();
  const { data: companies = [] } = useListCompanies();
  const { data: categories = [] } = useListCategories();
  const { data: collections = [] } = useListCollections();
  const { data: products = [] } = useListProducts();
  const createCompany = useCreateCompany();
  const createCategory = useCreateCategory();
  const createCollection = useCreateCollection();

  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 10 }, () => newRow()));

  // Bill-level company: "" = not selected, "mix" = mixed companies, otherwise company id
  const [billCompanyId, setBillCompanyId] = useState<string>("");
  const [updateProductCompanies, setUpdateProductCompanies] = useState(false);

  // Sticky company: last company selected in any row carries to new rows
  const stickyCompanyRef = useRef("");

  // When bill-level company changes: apply to empty/new rows + sticky (except "mix")
  // Rows that already matched an existing product keep their saved company to avoid silent mismatches
  const handleBillCompanyChange = (value: string) => {
    setBillCompanyId(value);
    if (value === "mix" || !value) {
      // Mix / none: clear company from rows that have no product yet — user sets per-row
      stickyCompanyRef.current = "";
      setRows(prev => prev.map(r => r.name.trim() ? r : { ...r, companyId: "" }));
    } else {
      stickyCompanyRef.current = value;
      // Don't silently override the company for rows tied to an existing product
      setRows(prev => prev.map(r => r._productCompanyId ? r : { ...r, companyId: value }));
    }
  };

  const tableRef = useRef<HTMLDivElement>(null);

  // Quick-add dialog state
  const [addDialog, setAddDialog] = useState<{ type: "company" | "category" | "collection"; rowId: string } | null>(null);

  const addRow = () => setRows(r => [...r, newRow(stickyCompanyRef.current)]);
  const removeRow = (id: string) => setRows(r => r.length > 1 ? r.filter(x => x._id !== id) : r);

  const updateRow = useCallback((id: string, field: keyof BulkPurchaseRow, value: string) => {
    setRows(rows => rows.map(r => r._id === id ? { ...r, [field]: value } : r));
    if (field === "companyId") {
      stickyCompanyRef.current = value;
    }
  }, []);

  // Auto-fill from existing product when name/code is entered
  // Always overrides ALL fields with the stored product data (existing product = use its data)
  const autoFillFromProduct = useCallback((rowId: string, field: "name" | "code", value: string) => {
    if (!value.trim()) return;
    const match = field === "code"
      ? products.find(p => p.code.toLowerCase() === value.toLowerCase().trim())
      : products.find(p => p.name.toLowerCase() === value.toLowerCase().trim());
    if (!match) return;
    const savedCompanyId = String(match.companyId ?? "");
    setRows(prev => prev.map(r => {
      if (r._id !== rowId) return r;
      return {
        ...r,
        code: match.code,
        name: match.name,
        purchasePrice: String(match.purchasePrice ?? ""),
        salePrice: String(match.salePrice ?? ""),
        categoryId: String(match.categoryId ?? ""),
        collectionId: String(match.collectionId ?? ""),
        companyId: savedCompanyId,
        _productCompanyId: savedCompanyId, // track the product's saved company
      };
    }));
    // Update sticky company whenever a match is found
    if (match.companyId) {
      stickyCompanyRef.current = savedCompanyId;
    }
  }, [products]);

  // Company mismatch: existing product whose selected company differs from its saved company
  const hasMismatch = (row: Row) =>
    !!row._productCompanyId && !!row.companyId && row.companyId !== row._productCompanyId;

  // Duplicate product detection (by name, case-insensitive)
  const validRows = rows.filter(r => r.name.trim() && parseFloat(r.quantity || "0") > 0);
  const nameCounts: Record<string, number> = {};
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (key) nameCounts[key] = (nameCounts[key] ?? 0) + 1;
  }
  const isDuplicate = (row: Row) => row.name.trim() && nameCounts[row.name.trim().toLowerCase()] > 1;

  const totalAmount = validRows.reduce((sum, r) => {
    return sum + parseFloat(r.quantity || "0") * parseFloat(r.purchasePrice || "0");
  }, 0);

  const handleSave = async () => {
    if (!billNumber.trim()) {
      toast({ title: "Bill number required", variant: "destructive" }); return;
    }
    if (validRows.length === 0) {
      toast({ title: "At least one product with name and quantity required", variant: "destructive" }); return;
    }
    const dupes = validRows.filter(r => isDuplicate(r));
    if (dupes.length > 0) {
      toast({ title: `Duplicate products: ${[...new Set(dupes.map(r => r.name))].join(", ")}`, variant: "destructive" }); return;
    }
    // Warn about company mismatches for existing products
    const mismatchCount = validRows.filter(hasMismatch).length;
    if (mismatchCount > 0 && !updateProductCompanies) {
      toast({
        title: `⚠️ Company mismatch on ${mismatchCount} product(s)`,
        description: `The selected company differs from those products' saved company. Their company won't change. Enable "Update Company" in the header to override.`,
        variant: "destructive",
      });
      return;
    }
    try {
      // Derive bill company from actual row companies (rows are the source of truth)
      const rowCompanies = [...new Set(validRows.map(r => r.companyId).filter(Boolean))];
      const isMix = rowCompanies.length > 1;
      const singleCompanyId = rowCompanies.length === 1
        ? rowCompanies[0]
        : (!isMix && billCompanyId && billCompanyId !== "mix" ? billCompanyId : undefined);
      const result = await bulkCreate.mutateAsync({
        billNumber: billNumber.trim(),
        billDate,
        notes: notes.trim() || undefined,
        companyId: isMix ? undefined : singleCompanyId,
        mixed: isMix,
        supplierName: isMix ? "Mix Companies" : undefined,
        items: validRows,
        isCredit,
        updateProductCompany: updateProductCompanies,
      } as any);
      toast({
        title: `✅ Bill #${result.billNumber} saved!`,
        description: `${result.itemCount} products · ${result.newProductCount} new · Total: ${fmt(result.totalAmount)}`,
      });
      setBillNumber(""); setNotes("");
      setBillDate(format(new Date(), "yyyy-MM-dd"));
      setIsCredit(false);
      setBillCompanyId("");
      setUpdateProductCompanies(false);
      stickyCompanyRef.current = "";
      setRows(Array.from({ length: 10 }, () => newRow()));
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    }
  };

  // Key navigation: Enter/Tab moves to next input cell
  const TOTAL_INPUT_COLS = 7;
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < TOTAL_INPUT_COLS) {
        const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${rowIdx}-${nextCol}"]`);
        el?.focus();
      } else {
        const nextRow = rowIdx + 1;
        if (nextRow >= rows.length) addRow();
        setTimeout(() => {
          const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${nextRow}-0"]`);
          el?.focus();
        }, 50);
      }
    }
  }

  // Quick-add handlers
  const handleAddMaster = async (name: string) => {
    if (!addDialog) return;
    let newId = "";
    if (addDialog.type === "company") {
      const c = await createCompany.mutateAsync(name);
      newId = String(c.id);
      stickyCompanyRef.current = newId;
    } else if (addDialog.type === "category") {
      const c = await createCategory.mutateAsync(name);
      newId = String(c.id);
    } else {
      const c = await createCollection.mutateAsync(name);
      newId = String(c.id);
    }
    const field = addDialog.type === "company" ? "companyId" : addDialog.type === "category" ? "categoryId" : "collectionId";
    updateRow(addDialog.rowId, field as keyof BulkPurchaseRow, newId);
    toast({ title: `✓ ${name} added` });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/inventory/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="font-bold text-base">Stock Purchase</h1>
        <span className="text-muted-foreground text-xs hidden sm:inline">· New products auto-created, existing get stock added</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/inventory/purchase-bills")}>
            <ClipboardList className="h-3.5 w-3.5 mr-1" />Purchase Report
          </Button>
        </div>
      </div>

      {/* ── Bill header bar ── */}
      <div className="flex flex-wrap gap-2 px-3 py-2 border-b bg-muted/20 shrink-0 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Bill Number *</label>
          <Input className="h-8 w-36 text-sm" placeholder="INV-125" value={billNumber} onChange={e => setBillNumber(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Date</label>
          <Input type="date" className="h-8 w-40 text-sm" value={billDate} onChange={e => setBillDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Company</label>
          <Select value={billCompanyId || "none"} onValueChange={v => handleBillCompanyChange(v === "none" ? "" : v)}>
            <SelectTrigger className={`h-8 w-44 text-sm ${billCompanyId === "mix" ? "border-purple-400 text-purple-700 font-semibold" : ""}`}>
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select —</SelectItem>
              <SelectItem value="mix">🔀 Mix Companies</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Notes</label>
          <Input className="h-8 w-48 text-sm" placeholder="Optional..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 ml-auto">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Items · Total</p>
            <p className="text-sm font-bold text-blue-700">{validRows.length} · {fmt(totalAmount)}</p>
          </div>
          <button
            type="button"
            onClick={() => setUpdateProductCompanies(v => !v)}
            title="When enabled, re-purchasing an existing product under a different company will update the product's saved company"
            className={`h-8 px-3 rounded-md border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              updateProductCompanies ? "bg-amber-500 border-amber-500 text-white" : "bg-card border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"
            }`}
          >
            <span className="text-sm">{updateProductCompanies ? "🟡" : "⚪"}</span>Update Company
          </button>
          <button
            type="button"
            onClick={() => setIsCredit(v => !v)}
            className={`h-8 px-3 rounded-md border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              isCredit ? "bg-orange-500 border-orange-500 text-white" : "bg-card border-border text-muted-foreground hover:border-orange-400 hover:text-orange-600"
            }`}
          >
            <span className="text-sm">{isCredit ? "🟠" : "⚪"}</span>Credit
          </button>
          <Button
            onClick={handleSave}
            disabled={bulkCreate.isPending || !billNumber.trim() || validRows.length === 0}
            className={`h-8 text-white ${isCredit ? "bg-orange-500 hover:bg-orange-600" : "bg-teal-600 hover:bg-teal-700"}`}
            size="sm"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {bulkCreate.isPending ? "Saving..." : isCredit ? "Save (Credit)" : "Save All"}
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="w-full text-sm border-collapse" style={{ minWidth: "1260px" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-800 text-white text-xs">
              <th className="py-2 px-2 text-center font-medium w-9 border-r border-slate-700">#</th>
              <th className="py-2 px-2 text-left font-medium w-[90px] border-r border-slate-700">Code</th>
              <th className="py-2 px-2 text-left font-medium border-r border-slate-700" style={{ minWidth: "180px" }}>Product Name *</th>
              <th className="py-2 px-2 text-left font-medium w-[140px] border-r border-slate-700">
                <span>Company</span>
                <span className="text-slate-400 font-normal text-[9px] ml-1">(sticky)</span>
              </th>
              <th className="py-2 px-2 text-left font-medium w-[130px] border-r border-slate-700">Category</th>
              <th className="py-2 px-2 text-left font-medium w-[130px] border-r border-slate-700">Collection</th>
              <th className="py-2 px-2 text-right font-medium w-[110px] border-r border-slate-700">Cost Price</th>
              <th className="py-2 px-2 text-right font-medium w-[100px] border-r border-slate-700">Sale Price</th>
              <th className="py-2 px-2 text-right font-medium w-[70px] border-r border-slate-700">Qty *</th>
              <th className="py-2 px-2 text-right font-medium w-[70px] border-r border-slate-700">Min Alert</th>
              <th className="py-2 px-2 text-center font-medium w-[120px] border-r border-slate-700">Expiry</th>
              <th className="py-2 px-2 text-right font-medium w-[100px] border-r border-slate-700">Item Total</th>
              <th className="py-2 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const qty = parseFloat(row.quantity || "0");
              const price = parseFloat(row.purchasePrice || "0");
              const lineTotal = qty > 0 && price > 0 ? qty * price : 0;
              const isValid = row.name.trim() && qty > 0;
              const isDupe = isDuplicate(row);
              const bg = isDupe
                ? "bg-red-50 dark:bg-red-950/20"
                : isValid ? "bg-white dark:bg-background"
                : idx % 2 === 0 ? "bg-gray-50 dark:bg-muted/10" : "bg-white dark:bg-background";

              const rowCompanyName = companies.find(c => String(c.id) === row.companyId)?.name;
              const isMismatchRow = hasMismatch(row);

              return (
                <tr key={row._id} className={`border-b ${bg} hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors`}>
                  {/* # */}
                  <td className="py-0.5 px-2 text-center text-xs text-muted-foreground font-medium border-r">
                    {isDupe ? <span title="Duplicate product">⚠️</span> : idx + 1}
                  </td>

                  {/* Code */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-0`}
                      className="w-full h-8 px-2 text-xs font-mono bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 rounded"
                      placeholder="CAB-001"
                      value={row.code}
                      onChange={e => updateRow(row._id, "code", e.target.value)}
                      onBlur={e => autoFillFromProduct(row._id, "code", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 0)}
                    />
                  </td>

                  {/* Product Name */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-1`}
                      className={`w-full h-8 px-2 text-sm bg-transparent focus:bg-white focus:outline-none focus:ring-1 rounded ${isDupe ? "focus:ring-red-400 text-red-700 font-semibold" : "focus:ring-teal-400"}`}
                      placeholder="Product name..."
                      value={row.name}
                      onChange={e => updateRow(row._id, "name", e.target.value)}
                      onBlur={e => autoFillFromProduct(row._id, "name", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 1)}
                    />
                  </td>

                  {/* Company (per-row, sticky) */}
                  <td className={`py-0.5 px-1 border-r ${isMismatchRow ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                    {isMismatchRow && (
                      <div className="text-[9px] text-amber-700 font-semibold px-1 leading-none pb-0.5" title={`Saved company: ${companies.find(c => String(c.id) === row._productCompanyId)?.name ?? row._productCompanyId}`}>
                        ⚠️ differs from saved
                      </div>
                    )}
                    <div className="flex items-center gap-0.5">
                      <Select
                        value={row.companyId || "none"}
                        onValueChange={v => updateRow(row._id, "companyId", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className={`h-8 flex-1 text-xs border-0 bg-transparent focus:bg-white focus:ring-1 px-2 min-w-0 ${isMismatchRow ? "focus:ring-amber-400 text-amber-800" : "focus:ring-teal-400"}`}>
                          <SelectValue placeholder="Company..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button
                        title="Add new company"
                        onClick={() => setAddDialog({ type: "company", rowId: row._id })}
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-teal-600 hover:bg-teal-50 shrink-0"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-0.5 px-1 border-r">
                    <div className="flex items-center gap-0.5">
                      <Select
                        value={row.categoryId || "none"}
                        onValueChange={v => updateRow(row._id, "categoryId", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-teal-400 px-2 min-w-0">
                          <SelectValue placeholder="Category..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button
                        title="Add new category"
                        onClick={() => setAddDialog({ type: "category", rowId: row._id })}
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-teal-600 hover:bg-teal-50 shrink-0"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>

                  {/* Collection */}
                  <td className="py-0.5 px-1 border-r">
                    <div className="flex items-center gap-0.5">
                      <Select
                        value={row.collectionId || "none"}
                        onValueChange={v => updateRow(row._id, "collectionId", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-teal-400 px-2 min-w-0">
                          <SelectValue placeholder="Collection..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {collections.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button
                        title="Add new collection"
                        onClick={() => setAddDialog({ type: "collection", rowId: row._id })}
                        className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-teal-600 hover:bg-teal-50 shrink-0"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>

                  {/* Cost Price */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-2`}
                      className="w-full h-8 px-2 text-sm text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 rounded"
                      type="number" min="0" placeholder="0"
                      value={row.purchasePrice}
                      onChange={e => updateRow(row._id, "purchasePrice", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 2)}
                    />
                  </td>

                  {/* Sale Price */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-3`}
                      className="w-full h-8 px-2 text-sm text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 rounded"
                      type="number" min="0" placeholder="0"
                      value={row.salePrice}
                      onChange={e => updateRow(row._id, "salePrice", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 3)}
                    />
                  </td>

                  {/* Qty */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-4`}
                      className="w-full h-8 px-2 text-sm text-right font-bold bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 rounded"
                      type="number" min="1" placeholder="0"
                      value={row.quantity}
                      onChange={e => updateRow(row._id, "quantity", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 4)}
                    />
                  </td>

                  {/* Min Alert */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-5`}
                      className="w-full h-8 px-2 text-sm text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 rounded"
                      type="number" min="0" placeholder="0"
                      value={row.minStockAlert}
                      onChange={e => updateRow(row._id, "minStockAlert", e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx, 5)}
                    />
                  </td>

                  {/* Expiry */}
                  <td className="py-0.5 px-1 border-r">
                    <input
                      data-cell={`${idx}-6`}
                      className="w-full h-8 px-2 text-xs bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 rounded"
                      type="date"
                      value={row.expiryDate}
                      onChange={e => updateRow(row._id, "expiryDate", e.target.value)}
                    />
                  </td>

                  {/* Item Total */}
                  <td className="py-0.5 px-2 text-right border-r">
                    {lineTotal > 0
                      ? <span className="text-sm font-semibold text-blue-700">{fmt(lineTotal)}</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>

                  {/* Delete */}
                  <td className="py-0.5 px-1 text-center">
                    <button
                      onClick={() => removeRow(row._id)}
                      className="h-7 w-7 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center mx-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Add row button row */}
            <tr className="bg-muted/5 border-b">
              <td colSpan={13} className="py-2 px-3">
                <button
                  onClick={addRow}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-teal-600 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />Add Row
                </button>
              </td>
            </tr>

            {/* Totals row */}
            {validRows.length > 0 && (
              <tr className="bg-slate-50 dark:bg-muted/20 font-semibold border-b-2 border-slate-300 sticky bottom-0">
                <td colSpan={8} className="py-2 px-3 text-xs text-muted-foreground border-r">
                  {billNumber && <span className="text-foreground">#{billNumber}</span>}
                  {billDate && <span className="ml-2">· {billDate}</span>}
                </td>
                <td className="py-2 px-2 text-right text-sm border-r">
                  {validRows.reduce((s, r) => s + parseFloat(r.quantity || "0"), 0)}
                </td>
                <td colSpan={2} className="py-2 px-2 border-r"></td>
                <td className="py-2 px-2 text-right text-sm text-blue-700 border-r">{fmt(totalAmount)}</td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom status bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/10 text-xs text-muted-foreground shrink-0">
        <span>Items: {rows.length} rows · {validRows.length} valid &nbsp;·&nbsp; Enter/Tab = next cell &nbsp;·&nbsp; ⊕ = add new master inline</span>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Total: {fmt(totalAmount)}</span>
          <Button
            onClick={handleSave}
            disabled={bulkCreate.isPending || !billNumber.trim() || validRows.length === 0}
            className="h-7 bg-teal-600 hover:bg-teal-700 text-white text-xs px-4"
            size="sm"
          >
            {bulkCreate.isPending ? "Saving..." : "Save (F5)"}
          </Button>
        </div>
      </div>

      {/* Quick-add dialogs */}
      <QuickAddDialog
        open={addDialog?.type === "company"}
        title="Company"
        onClose={() => setAddDialog(null)}
        onSave={handleAddMaster}
      />
      <QuickAddDialog
        open={addDialog?.type === "category"}
        title="Category"
        onClose={() => setAddDialog(null)}
        onSave={handleAddMaster}
      />
      <QuickAddDialog
        open={addDialog?.type === "collection"}
        title="Collection"
        onClose={() => setAddDialog(null)}
        onSave={handleAddMaster}
      />
    </div>
  );
}
