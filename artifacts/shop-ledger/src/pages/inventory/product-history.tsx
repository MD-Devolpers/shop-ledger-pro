import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGetProductHistory } from "@/lib/inventory-api";
import {
  ArrowLeft, ShoppingCart, PackageCheck, RotateCcw,
  PackageX, PackagePlus, SlidersHorizontal, Loader2
} from "lucide-react";

function fmt(n: number) { return n.toLocaleString("en-PK"); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }); }

interface Event {
  type: string;
  date: string;
  qty: number;
  [key: string]: any;
}

function EventIcon({ type }: { type: string }) {
  if (type === "purchase") return <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center"><PackageCheck className="h-4 w-4 text-blue-600" /></div>;
  if (type === "sale") return <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center"><ShoppingCart className="h-4 w-4 text-green-600" /></div>;
  if (type === "return") return <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center"><RotateCcw className="h-4 w-4 text-orange-600" /></div>;
  if (type === "replacement_sent") return <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center"><PackageX className="h-4 w-4 text-amber-600" /></div>;
  if (type === "replacement_received") return <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center"><PackagePlus className="h-4 w-4 text-emerald-600" /></div>;
  return <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" /></div>;
}

function EventCard({ event }: { event: Event }) {
  const isAdd = ["purchase", "return", "replacement_received"].includes(event.type) ||
    (event.type === "adjustment" && event.adjustmentType === "manual_add");
  const isRemove = ["sale", "replacement_sent"].includes(event.type) ||
    (event.type === "adjustment" && event.adjustmentType !== "manual_add");

  return (
    <div className="flex gap-3 items-start">
      <EventIcon type={event.type} />
      <div className="flex-1 min-w-0 border rounded-xl p-3 bg-card">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {event.type === "purchase" && (
              <>
                <p className="font-semibold text-sm text-blue-700">Purchase Bill</p>
                <p className="text-xs text-muted-foreground">Bill: {event.billNumber} · {event.supplierName}</p>
                <p className="text-xs">Rate: Rs {fmt(event.rate)} · Total: Rs {fmt(event.total)}</p>
              </>
            )}
            {event.type === "sale" && (
              <>
                <p className="font-semibold text-sm text-green-700">Product Sale</p>
                {event.customerName && <p className="text-xs text-muted-foreground">Customer: {event.customerName}</p>}
                <p className="text-xs">
                  Rate: Rs {fmt(event.salePrice)} · Profit: Rs {fmt(event.profit)}
                  {event.isCredit && <Badge variant="outline" className="text-xs ml-1 text-amber-600 border-amber-200">Credit</Badge>}
                </p>
              </>
            )}
            {event.type === "return" && (
              <>
                <p className="font-semibold text-sm text-orange-700">Customer Return</p>
                {event.reason && <p className="text-xs text-muted-foreground">{event.reason}</p>}
                <p className="text-xs">Returned: Rs {fmt(event.returnAmount)}</p>
              </>
            )}
            {event.type === "replacement_sent" && (
              <>
                <p className="font-semibold text-sm text-amber-700">Sent for Replacement</p>
                <p className="text-xs text-muted-foreground">Company: {event.companyName}</p>
                <p className="text-xs">Fault: {event.faultReason}</p>
                <Badge variant="outline" className={`text-[10px] mt-1 ${event.status === "completed" ? "text-green-600" : event.status === "rejected" ? "text-red-600" : "text-amber-600"}`}>{event.status}</Badge>
              </>
            )}
            {event.type === "replacement_received" && (
              <>
                <p className="font-semibold text-sm text-emerald-700">Replacement Received</p>
                <p className="text-xs text-muted-foreground">Added to stock</p>
              </>
            )}
            {event.type === "adjustment" && (
              <>
                <p className="font-semibold text-sm">Stock Adjustment</p>
                <p className="text-xs text-muted-foreground capitalize">{event.adjustmentType.replace("_", " ")}</p>
                {event.reason && <p className="text-xs text-muted-foreground">{event.reason}</p>}
              </>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`font-bold text-sm ${isAdd ? "text-green-600" : isRemove ? "text-red-600" : "text-foreground"}`}>
              {isAdd ? "+" : isRemove ? "−" : ""}{fmt(event.qty)}
            </p>
            <p className="text-xs text-muted-foreground">{fmtDate(event.date)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductHistory() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get("productId") ?? "0");

  const { data: history, isLoading } = useGetProductHistory(productId || null);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory/products")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{history?.productName ?? "Product History"}</h1>
          {history?.productCode && <p className="text-sm text-muted-foreground">Code: {history.productCode}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !history || history.events.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <SlidersHorizontal className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No history yet</p>
          <p className="text-sm">No transaction records found for this product</p>
        </div>
      ) : (
        <>
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            {(["purchase", "sale", "return", "replacement_sent", "replacement_received", "adjustment"] as const).map(type => {
              const count = history.events.filter(e => e.type === type).length;
              if (count === 0) return null;
              const labels: Record<string, string> = {
                purchase: "Purchases", sale: "Sales", return: "Returns",
                replacement_sent: "Replacements Sent", replacement_received: "Replacements Received",
                adjustment: "Adjustments",
              };
              return <Badge key={type} variant="secondary">{labels[type]}: {count}</Badge>;
            })}
          </div>

          <div className="space-y-3">
            {history.events.map((event, i) => (
              <EventCard key={i} event={event} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
