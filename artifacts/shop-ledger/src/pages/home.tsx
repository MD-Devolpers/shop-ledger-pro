import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetReportSummary, 
  useCreateEntry, 
  useListEntries,
  useDeleteEntry,
  useListCustomers,
  getGetReportSummaryQueryKey,
  getListEntriesQueryKey,
} from "@workspace/api-client-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { TrendingUp, TrendingDown, Wallet, CreditCard, Loader2, Trash2, Pencil, Handshake, ChevronDown, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EditEntryDialog from "@/components/edit-entry-dialog";

const entrySchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().optional(),
  profit: z.coerce.number().optional(),
  paymentMethod: z.enum(["cash", "digital"]),
  isCredit: z.boolean().default(false),
  customerName: z.string().optional(),
});

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<"cash_in" | "cash_out">("cash_in");
  const [editEntry, setEditEntry] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const { data: summary, isLoading: summaryLoading } = useGetReportSummary();
  const { data: todayEntries, isLoading: entriesLoading } = useListEntries({
    date: new Date().toISOString().split("T")[0],
  });
  // Fetch all customers (no filter) for the dropdown list
  const { data: allCustomers } = useListCustomers({});
  // Fetch filtered customers when user types
  const { data: filteredCustomers } = useListCustomers({ q: customerSearch });
  const customers = customerSearch ? filteredCustomers : allCustomers;

  const createEntry = useCreateEntry();
  const deleteEntry = useDeleteEntry();

  useEffect(() => {
    document.title = "Dashboard - LedgerEntries";
  }, []);

  const form = useForm<z.infer<typeof entrySchema>>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      amount: 0,
      description: "",
      paymentMethod: "cash",
      isCredit: false,
      customerName: "",
    },
  });

  const isCredit = form.watch("isCredit");

  const openDialog = (type: "cash_in" | "cash_out") => {
    setEntryType(type);
    form.reset({ amount: 0, description: "", profit: undefined, paymentMethod: "cash", isCredit: false, customerName: "" });
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof entrySchema>) => {
    createEntry.mutate(
      {
        data: {
          type: entryType,
          amount: data.amount,
          description: data.description || null,
          profit: data.profit != null && data.profit > 0 ? data.profit : null,
          paymentMethod: data.paymentMethod,
          isCredit: data.isCredit,
          customerName: data.isCredit ? (data.customerName || null) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          setDialogOpen(false);
          toast({
            title: entryType === "cash_in" ? "Cash In recorded" : "Cash Out recorded",
            description: `${formatCurrency(data.amount)} has been added.`,
          });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.error || "Failed to create entry.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          toast({ title: "Entry moved to recycle bin" });
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Balance Summary */}
      <div className="bg-primary text-primary-foreground p-5 pb-8">
        <p className="text-sm font-medium opacity-80">Total Balance (Cash + Digital)</p>
        {summaryLoading ? (
          <div className="h-10 w-40 bg-primary-foreground/20 rounded animate-pulse mt-1" />
        ) : (
          <h2 className="text-4xl font-bold mt-1" data-testid="total-balance">
            {formatCurrency(summary?.totalBalance ?? 0)}
          </h2>
        )}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="flex flex-col gap-1 bg-primary-foreground/10 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 opacity-70" />
              <p className="text-[11px] opacity-70">Cash</p>
            </div>
            <p className="text-sm font-bold" data-testid="cash-balance">
              {formatCurrency(summary?.cashBalance ?? 0)}
            </p>
          </div>
          <div className="flex flex-col gap-1 bg-primary-foreground/10 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 opacity-70" />
              <p className="text-[11px] opacity-70">Digital</p>
            </div>
            <p className="text-sm font-bold" data-testid="digital-balance">
              {formatCurrency(summary?.digitalBalance ?? 0)}
            </p>
          </div>
          <div className="flex flex-col gap-1 bg-amber-400/30 border border-amber-300/30 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Handshake className="h-3.5 w-3.5 opacity-80" />
              <p className="text-[11px] opacity-80">Credit</p>
            </div>
            <p className="text-sm font-bold" data-testid="credit-balance">
              {formatCurrency(summary?.creditBalance ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 -mt-4 flex gap-3">
        <Button
          className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white shadow-lg text-base font-semibold"
          onClick={() => openDialog("cash_in")}
          data-testid="button-cash-in"
        >
          <TrendingUp className="mr-2 h-5 w-5" />
          Cash In
        </Button>
        <Button
          className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white shadow-lg text-base font-semibold"
          onClick={() => openDialog("cash_out")}
          data-testid="button-cash-out"
        >
          <TrendingDown className="mr-2 h-5 w-5" />
          Cash Out
        </Button>
      </div>

      {/* Stats Row */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Today Entries</p>
          <p className="text-lg font-bold text-foreground" data-testid="today-entries-count">
            {summary?.todayEntries ?? 0}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Profit</p>
          <p className="text-lg font-bold text-green-600" data-testid="total-profit">
            {formatCurrency(summary?.totalProfit ?? 0)}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Credit Due</p>
          <p className="text-lg font-bold text-amber-600" data-testid="total-credit">
            {formatCurrency(summary?.totalCredit ?? 0)}
          </p>
        </div>
      </div>

      {/* Today's Entries */}
      <div className="flex-1 px-4 mt-4 pb-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Today's Entries
        </h3>
        {entriesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !todayEntries || todayEntries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No entries today</p>
            <p className="text-sm">Use Cash In or Cash Out to add entries</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-card border rounded-xl p-3 flex items-center gap-3"
                data-testid={`entry-${entry.id}`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    entry.type === "cash_in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                  }`}
                >
                  {entry.type === "cash_in" ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">
                      {entry.description || (entry.type === "cash_in" ? "Cash In" : "Cash Out")}
                    </p>
                    {entry.paymentMethod === "digital" && (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-blue-100 text-blue-700">
                        Digital
                      </Badge>
                    )}
                    {entry.isCredit && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                        Credit
                      </Badge>
                    )}
                  </div>
                  {entry.customerName && (
                    <p className="text-xs text-muted-foreground">{entry.customerName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(entry.entryDate), "h:mm a")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-base font-bold ${
                      entry.type === "cash_in" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {entry.type === "cash_in" ? "+" : "-"}
                    {formatCurrency(entry.amount)}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditEntry(entry.id)}
                      data-testid={`edit-entry-${entry.id}`}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(entry.id)}
                      data-testid={`delete-entry-${entry.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="entry-dialog">
          <DialogHeader>
            <DialogTitle className={entryType === "cash_in" ? "text-green-600" : "text-red-600"}>
              {entryType === "cash_in" ? "Cash In" : "Cash Out"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rs)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        className="text-xl font-bold h-12"
                        data-testid="input-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="What is this for?" {...field} data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {entryType === "cash_in" && (
                <FormField
                  control={form.control}
                  name="profit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        Profit (Optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Is sale mein kitna profit hua? (Optional)"
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-profit"
                        />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">Profit Tracker mein automatically show hoga</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="digital">Digital Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-3">
                <Controller
                  control={form.control}
                  name="isCredit"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary"
                        checked={field.value}
                        onChange={field.onChange}
                        data-testid="checkbox-is-credit"
                      />
                      <span className="text-sm">Mark as Credit</span>
                    </label>
                  )}
                />
              </div>
              {isCredit && (
                <>
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <Handshake className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>Yeh entry automatically Credits page mein bhi save hogi. Purana customer select karo toh amount add ho jayega.</span>
                  </div>
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              ref={customerInputRef}
                              placeholder="Customer ka naam likhein ya select karein..."
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setCustomerSearch(e.target.value);
                                setShowCustomerDropdown(true);
                              }}
                              onFocus={() => setShowCustomerDropdown(true)}
                              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                              autoComplete="off"
                              data-testid="input-customer-name"
                            />
                          </FormControl>
                          {/* Existing customers dropdown */}
                          {showCustomerDropdown && customers && customers.length > 0 && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                              <p className="text-[10px] text-muted-foreground px-3 pt-2 pb-1 uppercase tracking-wide font-semibold">Existing Customers</p>
                              {customers.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                                  onMouseDown={() => {
                                    field.onChange(c.name);
                                    setCustomerSearch(c.name);
                                    setShowCustomerDropdown(false);
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <UserCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                    <span className="text-sm font-medium">{c.name}</span>
                                  </div>
                                  <span className="text-xs text-amber-600 font-semibold flex-shrink-0">
                                    {formatCurrency(c.totalCredit)} pending
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          {showCustomerDropdown && (!customers || customers.length === 0) && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-xl shadow-lg p-3 text-xs text-muted-foreground">
                              No existing customers. Naya naam likhen.
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <Button
                type="submit"
                className={`w-full h-12 text-base font-semibold ${
                  entryType === "cash_in"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
                disabled={createEntry.isPending}
                data-testid="button-submit-entry"
              >
                {createEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Entry
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      {editEntry !== null && (
        <EditEntryDialog
          entryId={editEntry}
          onClose={() => setEditEntry(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
            setEditEntry(null);
          }}
        />
      )}
    </div>
  );
}
