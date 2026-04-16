import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Wallet, Banknote, Smartphone, Trash2, PlusCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGetReportSummary, getGetReportSummaryQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ClosingEntry {
  id: number;
  amount: number;
  source: "cash" | "digital";
  note: string | null;
  createdAt: string;
}

interface ClosingData {
  history: ClosingEntry[];
  personalWallet: number;
  cashWithdrawn: number;
  digitalWithdrawn: number;
}

const closingSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  source: z.enum(["cash", "digital"]),
  note: z.string().optional(),
});

type ClosingForm = z.infer<typeof closingSchema>;

const CLOSING_KEY = ["closing"];

export default function Closing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useGetReportSummary();

  const { data: closingData, isLoading: closingLoading } = useQuery<ClosingData>({
    queryKey: CLOSING_KEY,
    queryFn: () => apiFetch<ClosingData>("/api/closing"),
  });

  const form = useForm<ClosingForm>({
    resolver: zodResolver(closingSchema),
    defaultValues: { amount: 0, source: "cash", note: "" },
  });

  const watchSource = form.watch("source");

  const createClosing = useMutation({
    mutationFn: (data: ClosingForm) =>
      apiFetch("/api/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLOSING_KEY });
      queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
      toast({ title: "Transferred to Personal Wallet" });
      form.reset({ amount: 0, source: "cash", note: "" });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message || "Error", variant: "destructive" });
    },
  });

  const deleteClosing = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/closing/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLOSING_KEY });
      queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
      toast({ title: "Closing removed" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err?.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ClosingForm) => createClosing.mutate(data);

  const maxAmount = watchSource === "cash"
    ? (summary?.cashBalance ?? 0)
    : (summary?.digitalBalance ?? 0);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 text-white px-4 pt-6 pb-8">
        <p className="text-sm font-medium opacity-80 mb-1">Personal Wallet</p>
        {summaryLoading ? (
          <div className="h-10 w-32 bg-white/20 rounded animate-pulse" />
        ) : (
          <h2 className="text-4xl font-bold">
            {formatCurrency(summary?.personalWallet ?? 0)}
          </h2>
        )}
        <p className="text-xs opacity-70 mt-1">Total amount saved to personal wallet</p>

        {/* Cash & Digital available */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="bg-white/15 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 opacity-80" />
              <p className="text-[11px] opacity-80">Cash Available</p>
            </div>
            <p className="text-base font-bold">{formatCurrency(summary?.cashBalance ?? 0)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="h-4 w-4 opacity-80" />
              <p className="text-[11px] opacity-80">Digital Available</p>
            </div>
            <p className="text-base font-bold">{formatCurrency(summary?.digitalBalance ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 -mt-4">
        {/* New Closing Button */}
        <Button
          className="w-full shadow-md mb-5 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => {
            form.reset({ amount: 0, source: "cash", note: "" });
            setDialogOpen(true);
          }}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Closing — Transfer to Personal Wallet
        </Button>

        {/* Withdrawn summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-card border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Banknote className="h-4 w-4" />
              <span className="text-xs">Cash Withdrawn</span>
            </div>
            <p className="text-base font-bold">{formatCurrency(closingData?.cashWithdrawn ?? 0)}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1 text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span className="text-xs">Digital Withdrawn</span>
            </div>
            <p className="text-base font-bold">{formatCurrency(closingData?.digitalWithdrawn ?? 0)}</p>
          </div>
        </div>

        {/* History */}
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Closing History
        </h3>

        {closingLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !closingData?.history?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No closings yet</p>
            <p className="text-xs mt-1">Transfer cash or digital to your personal wallet</p>
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {closingData.history.map((entry) => (
              <div
                key={entry.id}
                className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                    entry.source === "cash"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {entry.source === "cash"
                      ? <Banknote className="h-4 w-4" />
                      : <Smartphone className="h-4 w-4" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(entry.amount)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        entry.source === "cash"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {entry.source === "cash" ? "Cash" : "Digital"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.createdAt), "dd MMM yyyy, hh:mm a")}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  onClick={() => deleteClosing.mutate(entry.id)}
                  disabled={deleteClosing.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-violet-600" />
              Transfer to Personal Wallet
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Source selector */}
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-green-600" />
                            Cash Account
                            <span className="text-muted-foreground text-xs ml-1">
                              ({formatCurrency(summary?.cashBalance ?? 0)} available)
                            </span>
                          </div>
                        </SelectItem>
                        <SelectItem value="digital">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-blue-600" />
                            Digital Account
                            <span className="text-muted-foreground text-xs ml-1">
                              ({formatCurrency(summary?.digitalBalance ?? 0)} available)
                            </span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (PKR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        min={1}
                        max={maxAmount}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Available: {formatCurrency(maxAmount)}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quick amount buttons */}
              {maxAmount > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {[25, 50, 75, 100].map((pct) => {
                    const val = Math.floor((maxAmount * pct) / 100);
                    return (
                      <Button
                        key={pct}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => form.setValue("amount", val)}
                      >
                        {pct}% ({formatCurrency(val)})
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Note */}
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Daily closing, personal use..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transfer summary */}
              {form.watch("amount") > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-3 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{watchSource === "cash" ? "Cash" : "Digital"}</p>
                    <p className="font-semibold text-red-600">-{formatCurrency(form.watch("amount"))}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Personal Wallet</p>
                    <p className="font-semibold text-violet-700">+{formatCurrency(form.watch("amount"))}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-violet-600 hover:bg-violet-700" disabled={createClosing.isPending}>
                  {createClosing.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Transfer
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
