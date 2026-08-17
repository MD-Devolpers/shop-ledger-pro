import { useState } from "react";
import { useCheckWarranty } from "@/lib/inventory-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, Search, Clock, User, Phone, Package } from "lucide-react";
import { format } from "date-fns";

function warrantyLabel(period: string | null, customDays: number | null): string {
  if (!period) return "No Warranty";
  switch (period) {
    case "7d": return "7 Days";
    case "1m": return "1 Month";
    case "3m": return "3 Months";
    case "6m": return "6 Months";
    case "custom": return `${customDays ?? 0} Days (Custom)`;
    default: return period;
  }
}

export default function WarrantyCheck() {
  const [invoiceInput, setInvoiceInput] = useState("");
  const [searchId, setSearchId] = useState<number | null>(null);

  const { data, isLoading, error } = useCheckWarranty(searchId);

  function handleSearch() {
    const id = parseInt(invoiceInput.trim());
    if (!isNaN(id) && id > 0) setSearchId(id);
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          Warranty Check
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enter an invoice number to check warranty status
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            type="number"
            placeholder="Invoice Number (e.g. 42)"
            value={invoiceInput}
            onChange={e => setInvoiceInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={!invoiceInput.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">
          Check
        </Button>
      </div>

      {/* Result */}
      {isLoading && <p className="text-center py-8 text-muted-foreground text-sm">Searching...</p>}

      {error && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50 text-center">
          <ShieldX className="h-8 w-8 mx-auto mb-2 text-red-500" />
          <p className="font-semibold text-red-700">Invoice Not Found</p>
          <p className="text-sm text-red-600 mt-1">Invoice #{searchId} was not found in your account</p>
        </div>
      )}

      {data && !error && (
        <div className="space-y-3">
          {/* Sale Summary */}
          <div className="border rounded-xl p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-teal-600" />
                Invoice #{data.saleId}
              </h2>
              <Badge variant={data.status === "cancelled" ? "destructive" : "secondary"}>
                {data.status === "cancelled" ? "Cancelled" : "Active"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Sale Date: {format(new Date(data.saleDate), "dd MMMM yyyy")}
              </p>
              {data.customerName && (
                <p className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  {data.customerName}
                </p>
              )}
              {data.contactNumber && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {data.contactNumber}
                </p>
              )}
              <p className="text-xs mt-1">
                Total Items: {data.totalItems} · With Warranty: {data.itemsWithWarranty}
              </p>
            </div>
          </div>

          {/* Warranty Items */}
          {data.itemsWithWarranty === 0 ? (
            <div className="border rounded-xl p-4 text-center text-muted-foreground bg-muted/20">
              <ShieldX className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="font-medium">No Warranty</p>
              <p className="text-sm mt-0.5">No warranty was set for any item in this sale</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Warranty Details</p>
              {data.warrantyItems.map((item: any) => {
                const expired = item.isExpired;
                const expiryDate = item.warrantyExpiryDate ? new Date(item.warrantyExpiryDate) : null;
                return (
                  <div
                    key={item.itemId}
                    className={`border rounded-xl p-3 ${expired ? "bg-red-50 border-red-200" : "bg-teal-50 border-teal-200"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.productCode} · Qty: {item.quantity}</p>
                      </div>
                      {expired ? (
                        <Badge variant="destructive" className="shrink-0">Expired</Badge>
                      ) : (
                        <Badge className="bg-teal-600 text-white shrink-0">Active</Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Warranty Period:</span>
                        <p className="font-semibold">{warrantyLabel(item.warrantyPeriod, item.warrantyCustomDays)}</p>
                      </div>
                      {expiryDate && (
                        <div>
                          <span className="text-muted-foreground">Expiry Date:</span>
                          <p className={`font-semibold ${expired ? "text-red-700" : "text-teal-700"}`}>
                            {format(expiryDate, "dd MMM yyyy")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
