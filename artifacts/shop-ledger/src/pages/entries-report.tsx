import { useEffect, useState, useMemo } from "react";
import { useListEntries } from "@workspace/api-client-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  addWeeks,
  addMonths,
} from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TableIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterMode = "daily" | "weekly" | "monthly" | "custom";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function EntriesReport() {
  const [mode, setMode] = useState<FilterMode>("daily");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [monthRef, setMonthRef] = useState(() => new Date());
  const [customStart, setCustomStart] = useState(todayStr());
  const [customEnd, setCustomEnd] = useState(todayStr());

  useEffect(() => {
    document.title = "Entries Report - LedgerEntries";
  }, []);

  // Compute API params from current mode
  const queryParams = useMemo(() => {
    if (mode === "daily") return { date: selectedDate };
    if (mode === "weekly") {
      const ws = startOfWeek(weekRef, { weekStartsOn: 1 });
      const we = endOfWeek(weekRef, { weekStartsOn: 1 });
      return {
        start_date: format(ws, "yyyy-MM-dd"),
        end_date: format(we, "yyyy-MM-dd"),
      };
    }
    if (mode === "monthly") {
      return {
        start_date: format(startOfMonth(monthRef), "yyyy-MM-dd"),
        end_date: format(endOfMonth(monthRef), "yyyy-MM-dd"),
      };
    }
    // custom
    return { start_date: customStart, end_date: customEnd };
  }, [mode, selectedDate, weekRef, monthRef, customStart, customEnd]);

  const { data: entries = [], isLoading } = useListEntries(queryParams as any);

  // Summary
  const summary = useMemo(() => {
    const totalIn = entries.filter((e) => e.type === "cash_in").reduce((s, e) => s + e.amount, 0);
    const totalOut = entries.filter((e) => e.type === "cash_out").reduce((s, e) => s + e.amount, 0);
    const totalProfit = entries.reduce((s, e) => s + (e.profit ?? 0), 0);
    const cashIn = entries.filter((e) => e.type === "cash_in" && e.paymentMethod === "cash").reduce((s, e) => s + e.amount, 0);
    const digitalIn = entries.filter((e) => e.type === "cash_in" && e.paymentMethod === "digital").reduce((s, e) => s + e.amount, 0);
    return { totalIn, totalOut, net: totalIn - totalOut, totalProfit, cashIn, digitalIn, count: entries.length };
  }, [entries]);

  // Sorted entries (newest first)
  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()),
    [entries]
  );

  // Period label
  const periodLabel = useMemo(() => {
    if (mode === "daily") return format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy");
    if (mode === "weekly") {
      const ws = startOfWeek(weekRef, { weekStartsOn: 1 });
      const we = endOfWeek(weekRef, { weekStartsOn: 1 });
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    if (mode === "monthly") return format(monthRef, "MMMM yyyy");
    return `${customStart} to ${customEnd}`;
  }, [mode, selectedDate, weekRef, monthRef, customStart, customEnd]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <TableIcon className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Entries Report</h1>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Mode Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-muted rounded-xl p-1">
          {(["daily", "weekly", "monthly", "custom"] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors ${
                mode === m
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Date Controls */}
        {mode === "daily" && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 text-sm font-medium"
            />
          </div>
        )}

        {mode === "weekly" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => setWeekRef((d) => subWeeks(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-foreground">
                {format(startOfWeek(weekRef, { weekStartsOn: 1 }), "MMM d")} –{" "}
                {format(endOfWeek(weekRef, { weekStartsOn: 1 }), "MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">
                Week {format(weekRef, "w")} of {format(weekRef, "yyyy")}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              disabled={endOfWeek(weekRef, { weekStartsOn: 1 }) >= new Date()}
              onClick={() => setWeekRef((d) => addWeeks(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {mode === "monthly" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => setMonthRef((d) => subMonths(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-foreground">{format(monthRef, "MMMM yyyy")}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              disabled={startOfMonth(monthRef) >= startOfMonth(new Date())}
              onClick={() => setMonthRef((d) => addMonths(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {mode === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">From</label>
              <Input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">To</label>
              <Input
                type="date"
                value={customEnd}
                max={todayStr()}
                min={customStart}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-xs text-green-700 font-medium">Total In</p>
            <p className="text-base font-bold text-green-700">{formatCurrency(summary.totalIn)}</p>
            <p className="text-[10px] text-green-600 mt-0.5">
              Cash {formatCurrency(summary.cashIn)} · Digital {formatCurrency(summary.digitalIn)}
            </p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs text-red-700 font-medium">Total Out</p>
            <p className="text-base font-bold text-red-700">{formatCurrency(summary.totalOut)}</p>
          </div>
          <div className={`border rounded-xl p-3 ${summary.net >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
            <p className={`text-xs font-medium ${summary.net >= 0 ? "text-blue-700" : "text-orange-700"}`}>Net</p>
            <p className={`text-base font-bold ${summary.net >= 0 ? "text-blue-700" : "text-orange-700"}`}>
              {formatCurrency(summary.net)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 col-span-1">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-700 font-medium">Profit</p>
              <p className="text-base font-bold text-amber-700">{formatCurrency(summary.totalProfit)}</p>
            </div>
            <div className="bg-card border rounded-xl p-3">
              <p className="text-xs text-muted-foreground font-medium">Entries</p>
              <p className="text-base font-bold text-foreground">{summary.count}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            All Entries
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-card border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <TableIcon className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">No entries for this period</p>
              <p className="text-xs mt-1">Try a different date range</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden bg-card">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 bg-muted/60 border-b text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>Description / Date</span>
                <span className="text-center">Method</span>
                <span className="text-center">Type</span>
                <span className="text-right">Amount</span>
              </div>

              {/* Table rows */}
              <div className="divide-y">
                {sorted.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-3 py-2.5 text-sm ${
                      idx % 2 === 1 ? "bg-muted/20" : ""
                    }`}
                  >
                    {/* Description + date */}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-xs truncate leading-tight">
                        {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(entry.entryDate), mode === "daily" ? "h:mm a" : "MMM d, h:mm a")}
                        </span>
                        {entry.isCredit && (
                          <Badge className="text-[9px] px-1 py-0 h-3.5 bg-amber-100 text-amber-700 border-0 leading-none">
                            Credit
                          </Badge>
                        )}
                        {(entry as any).customerName && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            · {(entry as any).customerName}
                          </span>
                        )}
                        {entry.profit != null && entry.profit > 0 && (
                          <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1 py-0 rounded-full">
                            +{formatCurrency(entry.profit)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment method */}
                    <div className="flex-shrink-0">
                      {entry.paymentMethod === "digital" ? (
                        <Badge className="text-[9px] px-1.5 py-0 h-5 bg-blue-100 text-blue-700 border-0">
                          Digital
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] px-1.5 py-0 h-5 bg-gray-100 text-gray-600 border-0">
                          Cash
                        </Badge>
                      )}
                    </div>

                    {/* Type icon */}
                    <div className="flex-shrink-0">
                      {entry.type === "cash_in" ? (
                        <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-xs font-bold ${
                          entry.type === "cash_in" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {entry.type === "cash_in" ? "+" : "-"}
                        {formatCurrency(entry.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table footer totals */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2.5 bg-muted/40 border-t">
                <div>
                  <p className="text-xs font-bold text-foreground">{summary.count} entries total</p>
                  <p className="text-[10px] text-muted-foreground">
                    In: {formatCurrency(summary.totalIn)} · Out: {formatCurrency(summary.totalOut)}
                  </p>
                </div>
                <div />
                <div />
                <div className="text-right">
                  <p className={`text-xs font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {summary.net >= 0 ? "+" : ""}{formatCurrency(summary.net)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">net</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
