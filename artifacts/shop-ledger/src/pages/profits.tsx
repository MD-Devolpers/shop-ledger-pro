import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfitReport,
  useUpdateEntryProfit,
  getGetProfitReportQueryKey,
} from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Loader2, Save, ArrowDownCircle, CalendarDays, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  isCredit?: boolean;
  customerName?: string | null;
  entryDate: string;
};

function isCreditPayment(entry: Entry) {
  return (
    entry.description?.toLowerCase().includes("credit payment received from") ||
    entry.description?.toLowerCase().includes("payment received from")
  );
}

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

  const creditPayment = isCreditPayment(entry);

  return (
    <div
      className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${
        creditPayment ? "border-green-200 bg-green-50/30" : ""
      }`}
      data-testid={`profit-entry-${entry.id}`}
    >
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          creditPayment
            ? "bg-green-100 text-green-600"
            : entry.type === "cash_in"
            ? "bg-green-100 text-green-600"
            : "bg-red-100 text-red-600"
        }`}
      >
        {creditPayment ? (
          <ArrowDownCircle className="h-4 w-4" />
        ) : entry.type === "cash_in" ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">
            {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
          </p>
          {creditPayment && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-0 flex-shrink-0">
              Credit Payment
            </Badge>
          )}
          {entry.isCredit && !creditPayment && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0 flex-shrink-0">
              Credit Given
            </Badge>
          )}
        </div>
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
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-primary"
            onClick={handleSave}
            data-testid={`save-profit-${entry.id}`}
          >
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
  const [period, setPeriod] = useState<"daily" | "yesterday">("daily");

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

  const allEntries = (report?.entriesWithProfit ?? []).filter((e) => !isCreditPayment(e));
  const profitEntries = allEntries.filter((e) => e.profit != null);
  const totalProfit = report?.totalProfit ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Profit Tracker</h1>
        <p className="text-xs text-muted-foreground">Har entry ka profit record karo</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="w-full mb-4 grid grid-cols-2">
            <TabsTrigger value="daily" data-testid="tab-today-profit">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Aaj (Today)
            </TabsTrigger>
            <TabsTrigger value="yesterday" data-testid="tab-yesterday-profit">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Kal (Yesterday)
            </TabsTrigger>
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
                  <p className="text-sm text-primary font-medium">
                    Total Profit — {period === "daily" ? "Aaj" : "Kal"}
                  </p>
                  <p className="text-3xl font-bold text-primary mt-1" data-testid="total-profit-display">
                    {formatCurrency(totalProfit)}
                  </p>
                  {report && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(report.startDate), "MMM d, yyyy")}
                      {" · "}
                      {profitEntries.length} entries mein profit set hai
                    </p>
                  )}
                </div>

                {/* All entries - set profit on any entry */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {allEntries.length} entries — profit enter karo
                  </p>
                </div>
                <div className="space-y-2">
                  {allEntries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="font-medium">
                        {period === "daily" ? "Aaj koi entry nahi" : "Kal koi entry nahi thi"}
                      </p>
                      <p className="text-sm">Home screen se entries add karo</p>
                    </div>
                  ) : (
                    allEntries
                      .slice()
                      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
                      .map((entry) => (
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
