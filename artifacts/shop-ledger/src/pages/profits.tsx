import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfitReport,
  useUpdateEntryProfit,
  getGetProfitReportQueryKey,
} from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(amount);
}

type Entry = {
  id: number;
  type: string;
  amount: number;
  description?: string | null;
  profit?: number | null;
  entryDate: string;
};

function ProfitEntryRow({ entry, onSave }: { entry: Entry; onSave: (id: number, profit: number | null) => void }) {
  const [profit, setProfit] = useState<string>(entry.profit != null ? String(entry.profit) : "");
  const [changed, setChanged] = useState(false);

  const handleChange = (val: string) => {
    setProfit(val);
    setChanged(true);
  };

  const handleSave = () => {
    const val = profit === "" ? null : parseFloat(profit);
    onSave(entry.id, val);
    setChanged(false);
  };

  return (
    <div className="bg-card border rounded-xl p-3 flex items-center gap-3" data-testid={`profit-entry-${entry.id}`}>
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          entry.type === "cash_in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
        }`}
      >
        {entry.type === "cash_in" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
        </p>
        <p className="text-xs text-muted-foreground">{format(new Date(entry.entryDate), "MMM d, h:mm a")}</p>
        <p className={`text-xs font-semibold ${entry.type === "cash_in" ? "text-green-600" : "text-red-600"}`}>
          {entry.type === "cash_in" ? "+" : "-"}{formatCurrency(entry.amount)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-28">
          <Input
            type="number"
            placeholder="Profit"
            value={profit}
            onChange={(e) => handleChange(e.target.value)}
            className="h-8 text-sm"
            data-testid={`profit-input-${entry.id}`}
          />
        </div>
        {changed && (
          <Button variant="outline" size="icon" className="h-8 w-8 text-primary" onClick={handleSave} data-testid={`save-profit-${entry.id}`}>
            <Save className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Profits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => { document.title = "Profit Tracker - LedgerEntries"; }, []);

  const { data: report, isLoading } = useGetProfitReport(
    { period },
    { query: { queryKey: getGetProfitReportQueryKey({ period }) } }
  );

  const updateProfit = useUpdateEntryProfit();

  const handleSaveProfit = (id: number, profit: number | null) => {
    updateProfit.mutate(
      { id, data: { profit } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfitReportQueryKey({ period }) });
          toast({ title: "Profit updated" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.error || "Failed to update profit.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Profit Tracker</h1>
        <p className="text-xs text-muted-foreground">Record and track profit per entry</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="daily" data-testid="tab-daily-profit">Daily</TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly-profit">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly-profit">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="mt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <>
                {/* Total Profit Card */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
                  <p className="text-sm text-primary font-medium">Total Profit ({period})</p>
                  <p className="text-3xl font-bold text-primary mt-1" data-testid="total-profit-display">
                    {formatCurrency(report?.totalProfit ?? 0)}
                  </p>
                  {report && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(report.startDate), "MMM d")} — {format(new Date(report.endDate), "MMM d, yyyy")}
                    </p>
                  )}
                </div>

                {/* Entries */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Set profit per entry
                </p>
                <div className="space-y-2">
                  {!report?.entriesWithProfit || report.entriesWithProfit.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="font-medium">No entries for this period</p>
                      <p className="text-sm">Add entries first from the home screen</p>
                    </div>
                  ) : (
                    report.entriesWithProfit.map((entry) => (
                      <ProfitEntryRow key={entry.id} entry={entry} onSave={handleSaveProfit} />
                    ))
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
