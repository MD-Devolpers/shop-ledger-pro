import { useEffect, useState, useMemo } from "react";
import { useListEntries } from "@workspace/api-client-react";
import { FileBarChart2, Search, TrendingUp, TrendingDown, CalendarDays, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";

type Period = "daily" | "weekly" | "monthly" | "custom";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getDateRange(period: Period, customStart: string, customEnd: string) {
  const today = new Date();
  if (period === "daily") {
    const d = format(today, "yyyy-MM-dd");
    return { start: d, end: d };
  }
  if (period === "weekly") {
    return {
      start: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      end: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };
  }
  if (period === "monthly") {
    return {
      start: format(startOfMonth(today), "yyyy-MM-dd"),
      end: format(endOfMonth(today), "yyyy-MM-dd"),
    };
  }
  return { start: customStart, end: customEnd };
}

export default function DigitalReport() {
  const [period, setPeriod] = useState<Period>("daily");
  const [customStart, setCustomStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Digital Report - LedgerEntries";
  }, []);

  const { start, end } = getDateRange(period, customStart, customEnd);

  const { data: entries, isLoading } = useListEntries({
    payment_method: "digital",
    start_date: start,
    end_date: end,
  });

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const nameMatch = e.customerName?.toLowerCase().includes(q);
      const descMatch = e.description?.toLowerCase().includes(q);
      return nameMatch || descMatch;
    });
  }, [entries, search]);

  const totalIn = filtered
    .filter((e) => e.type === "cash_in")
    .reduce((s, e) => s + e.amount, 0);

  const totalOut = filtered
    .filter((e) => e.type === "cash_out")
    .reduce((s, e) => s + e.amount, 0);

  const netBalance = totalIn - totalOut;

  const periods: { key: Period; label: string }[] = [
    { key: "daily", label: "Today" },
    { key: "weekly", label: "This Week" },
    { key: "monthly", label: "This Month" },
    { key: "custom", label: "Custom Date" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileBarChart2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Digital Report</h1>
            <p className="text-xs text-muted-foreground">All digital payment entries</p>
          </div>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                period === p.key
                  ? "bg-blue-600 text-white shadow"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {period === "custom" && (
          <div className="mt-2 flex gap-2 items-center">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1 block">From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1 block">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="px-4 grid grid-cols-3 gap-2 mb-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-green-700 font-medium uppercase tracking-wide">Digital In</p>
          <p className="text-base font-bold text-green-700 mt-0.5">{formatCurrency(totalIn)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-[10px] text-red-700 font-medium uppercase tracking-wide">Digital Out</p>
          <p className="text-base font-bold text-red-700 mt-0.5">{formatCurrency(totalOut)}</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${netBalance >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"}`}>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${netBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>Net</p>
          <p className={`text-base font-bold mt-0.5 ${netBalance >= 0 ? "text-blue-700" : "text-orange-700"}`}>{formatCurrency(netBalance)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or account number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {search && (
          <p className="text-xs text-muted-foreground mt-1 pl-1">{filtered.length} result{filtered.length !== 1 ? "s" : ""} found</p>
        )}
      </div>

      {/* Entries List */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileBarChart2 className="h-12 w-12 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No digital entries found</p>
            <p className="text-sm mt-1">
              {search ? "Try a different search term" : "No digital transactions in this period"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <div key={entry.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.type === "cash_in"
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {entry.type === "cash_in" ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {entry.customerName && (
                      <p className="text-sm font-semibold truncate">{entry.customerName}</p>
                    )}
                    {entry.description && (
                      <p className={`text-sm truncate ${entry.customerName ? "text-muted-foreground" : "font-medium"}`}>
                        {entry.customerName ? `· ${entry.description}` : entry.description}
                      </p>
                    )}
                    {!entry.customerName && !entry.description && (
                      <p className="text-sm font-medium text-muted-foreground">
                        {entry.type === "cash_in" ? "Digital In" : "Digital Out"}
                      </p>
                    )}
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-blue-100 text-blue-700 ml-auto">
                      Digital
                    </Badge>
                    {entry.isCredit && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">Credit</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CalendarDays className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.entryDate), "dd MMM yyyy, hh:mm a")}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-base font-bold flex-shrink-0 ${
                    entry.type === "cash_in" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {entry.type === "cash_in" ? "+" : "-"}
                  {formatCurrency(entry.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
