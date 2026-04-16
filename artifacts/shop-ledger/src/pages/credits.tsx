import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCredits,
  useCreateCredit,
  useUpdateCredit,
  useDeleteCredit,
  useListCustomers,
  useCreateEntry,
  getListCreditsQueryKey,
  getGetReportSummaryQueryKey,
  getListEntriesQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Users,
  Plus,
  Loader2,
  CheckCircle2,
  Trash2,
  Banknote,
  Smartphone,
  ArrowDownCircle,
  Wallet,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Eye,
  EyeOff,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const creditSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  phone: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().optional(),
  type: z.enum(["given", "received"]),
  dueDate: z.string().optional(),
});

const receivePaymentSchema = z.object({
  amountReceived: z.coerce.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["cash", "digital"]),
});

type Credit = {
  id: number;
  customerName: string;
  phone?: string | null;
  amount: number;
  description?: string | null;
  type: string;
  status: string;
  dueDate?: string | null;
  createdAt: string;
};

// ── Single credit entry card ──────────────────────────────────────────────────
function CreditCard({
  credit,
  onMarkPaid,
  onDelete,
  onReceivePayment,
}: {
  credit: Credit;
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
  onReceivePayment: (credit: Credit) => void;
}) {
  return (
    <div className="bg-card border rounded-xl p-4" data-testid={`credit-${credit.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{credit.customerName}</p>
            <Badge
              className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                credit.status === "paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {credit.status === "paid" ? "Paid" : "Pending"}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 ${
                credit.type === "given"
                  ? "text-red-600 border-red-200"
                  : "text-green-600 border-green-200"
              }`}
            >
              {credit.type === "given" ? "Given" : "Received"}
            </Badge>
          </div>
          {credit.phone && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {credit.phone}
            </p>
          )}
          {credit.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{credit.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(credit.createdAt), "MMM d, yyyy")}
            {credit.dueDate && ` · Due: ${format(new Date(credit.dueDate), "MMM d, yyyy")}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p
            className={`font-bold text-base ${
              credit.type === "given" ? "text-red-600" : "text-green-600"
            }`}
          >
            {formatCurrency(credit.amount)}
          </p>
          <div className="flex gap-1 flex-wrap justify-end">
            {credit.status === "pending" && credit.type === "given" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 gap-1"
                onClick={() => onReceivePayment(credit)}
                data-testid={`receive-payment-${credit.id}`}
              >
                <ArrowDownCircle className="h-3.5 w-3.5" />
                Receive
              </Button>
            )}
            {credit.status === "pending" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => onMarkPaid(credit.id)}
                title="Mark as fully paid (no cash entry)"
                data-testid={`mark-paid-${credit.id}`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(credit.id)}
              data-testid={`delete-credit-${credit.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Per-customer expandable report card ───────────────────────────────────────
function CustomerReportCard({
  customerName,
  credits,
  onMarkPaid,
  onDelete,
  onReceivePayment,
}: {
  customerName: string;
  credits: Credit[];
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
  onReceivePayment: (credit: Credit) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const pendingGiven = credits
    .filter((c) => c.type === "given" && c.status === "pending")
    .reduce((s, c) => s + c.amount, 0);
  const pendingReceived = credits
    .filter((c) => c.type === "received" && c.status === "pending")
    .reduce((s, c) => s + c.amount, 0);
  const totalPaid = credits
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount, 0);
  const pendingCount = credits.filter((c) => c.status === "pending").length;
  const hasPending = pendingCount > 0;

  const phone = credits.find((c) => c.phone)?.phone;

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      {/* Customer header row */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 gap-3 text-left hover:bg-accent/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{customerName}</p>
            {phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {phone}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {pendingGiven > 0 && (
                <span className="text-xs text-red-600 font-medium">
                  Owes: {formatCurrency(pendingGiven)}
                </span>
              )}
              {pendingReceived > 0 && (
                <span className="text-xs text-green-600 font-medium">
                  You owe: {formatCurrency(pendingReceived)}
                </span>
              )}
              {totalPaid > 0 && !hasPending && (
                <span className="text-xs text-muted-foreground">
                  Cleared: {formatCurrency(totalPaid)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasPending && (
            <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] h-5 px-1.5">
              {pendingCount} pending
            </Badge>
          )}
          {!hasPending && (
            <Badge className="bg-green-100 text-green-700 border-0 text-[10px] h-5 px-1.5">
              Clear
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded detail list */}
      {expanded && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-2">
          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-red-50 border border-red-100 rounded-lg p-2 text-center">
              <p className="text-[10px] text-red-500 font-medium">Pending Given</p>
              <p className="text-sm font-bold text-red-700">{formatCurrency(pendingGiven)}</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-center">
              <p className="text-[10px] text-green-500 font-medium">Pending Received</p>
              <p className="text-sm font-bold text-green-700">{formatCurrency(pendingReceived)}</p>
            </div>
            <div className="bg-muted border rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">Total Paid</p>
              <p className="text-sm font-bold">{formatCurrency(totalPaid)}</p>
            </div>
          </div>

          {/* Individual entries list */}
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
            All Entries ({credits.length})
          </p>
          {credits
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((credit) => (
              <div
                key={credit.id}
                className="bg-card border rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      className={`text-[10px] px-1.5 py-0 h-4 border-0 ${
                        credit.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {credit.status === "paid" ? "Paid" : "Pending"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${
                        credit.type === "given"
                          ? "text-red-600 border-red-200"
                          : "text-green-600 border-green-200"
                      }`}
                    >
                      {credit.type === "given" ? "Given" : "Received"}
                    </Badge>
                  </div>
                  {credit.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {credit.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(credit.createdAt), "MMM d, yyyy")}
                    {credit.dueDate &&
                      ` · Due: ${format(new Date(credit.dueDate), "MMM d, yyyy")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <p
                    className={`font-bold text-sm ${
                      credit.type === "given" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {formatCurrency(credit.amount)}
                  </p>
                  {credit.status === "pending" && credit.type === "given" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] border-green-300 text-green-700 hover:bg-green-50 gap-1 px-2"
                      onClick={() => onReceivePayment(credit)}
                    >
                      <ArrowDownCircle className="h-3 w-3" />
                      Pay
                    </Button>
                  )}
                  {credit.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:bg-green-50"
                      onClick={() => onMarkPaid(credit.id)}
                      title="Mark paid"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => onDelete(credit.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main Credits page ─────────────────────────────────────────────────────────
export default function Credits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null);
  const [tab, setTab] = useState("given");
  const [showPaidGiven, setShowPaidGiven] = useState(false);
  const [showPaidReceived, setShowPaidReceived] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");

  useEffect(() => {
    document.title = "Credits - LedgerEntries";
  }, []);

  const { data: credits, isLoading } = useListCredits();
  const { data: customers } = useListCustomers({ q: customerSearch });
  const createCredit = useCreateCredit();
  const updateCredit = useUpdateCredit();
  const deleteCredit = useDeleteCredit();
  const createEntry = useCreateEntry();

  const form = useForm<z.infer<typeof creditSchema>>({
    resolver: zodResolver(creditSchema),
    defaultValues: {
      customerName: "",
      phone: "",
      amount: 0,
      description: "",
      type: "given",
      dueDate: "",
    },
  });

  const paymentForm = useForm<z.infer<typeof receivePaymentSchema>>({
    resolver: zodResolver(receivePaymentSchema),
    defaultValues: { amountReceived: 0, paymentMethod: "cash" },
  });

  // Pending-only by default; toggle to see paid history
  const givenCredits = credits?.filter((c) => c.type === "given") ?? [];
  const receivedCredits = credits?.filter((c) => c.type === "received") ?? [];

  const filteredGiven = showPaidGiven
    ? givenCredits
    : givenCredits.filter((c) => c.status === "pending");
  const filteredReceived = showPaidReceived
    ? receivedCredits
    : receivedCredits.filter((c) => c.status === "pending");

  const paidGivenCount = givenCredits.filter((c) => c.status === "paid").length;
  const paidReceivedCount = receivedCredits.filter((c) => c.status === "paid").length;

  // Group ALL credits by customer for the report view
  const customerMap = new Map<string, Credit[]>();
  for (const c of credits ?? []) {
    const key = c.customerName.trim().toLowerCase();
    const existing = [...customerMap.keys()].find(
      (k) => k.toLowerCase() === key
    );
    if (existing) {
      customerMap.get(existing)!.push(c);
    } else {
      customerMap.set(c.customerName.trim(), [c]);
    }
  }

  const filteredCustomers = [...customerMap.entries()]
    .filter(([name]) =>
      reportSearch === "" || name.toLowerCase().includes(reportSearch.toLowerCase())
    )
    .sort((a, b) => {
      const aPending = a[1]
        .filter((c) => c.status === "pending")
        .reduce((s, c) => s + c.amount, 0);
      const bPending = b[1]
        .filter((c) => c.status === "pending")
        .reduce((s, c) => s + c.amount, 0);
      return bPending - aPending;
    });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListCreditsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
  };

  const onSubmit = (data: z.infer<typeof creditSchema>) => {
    createCredit.mutate(
      {
        data: {
          customerName: data.customerName,
          phone: data.phone || null,
          amount: data.amount,
          description: data.description || null,
          type: data.type,
          dueDate: data.dueDate || null,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          setDialogOpen(false);
          form.reset();
          toast({ title: "Credit entry added" });
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.error || "Failed to add credit.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const openReceivePayment = (credit: Credit) => {
    setSelectedCredit(credit);
    paymentForm.reset({ amountReceived: credit.amount, paymentMethod: "cash" });
    setPaymentDialogOpen(true);
  };

  const onReceivePayment = (data: z.infer<typeof receivePaymentSchema>) => {
    if (!selectedCredit) return;

    const received = data.amountReceived;
    const outstanding = selectedCredit.amount;
    const isFullPayment = received >= outstanding;

    createEntry.mutate(
      {
        data: {
          type: "cash_in",
          amount: received,
          description: `Credit payment received from ${selectedCredit.customerName}`,
          paymentMethod: data.paymentMethod,
          isCredit: false,
          customerName: null,
        },
      },
      {
        onSuccess: () => {
          if (isFullPayment) {
            updateCredit.mutate(
              { id: selectedCredit.id, data: { status: "paid" } },
              {
                onSuccess: () => {
                  invalidateAll();
                  setPaymentDialogOpen(false);
                  setSelectedCredit(null);
                  toast({
                    title: "Payment received!",
                    description: `${formatCurrency(received)} — ${selectedCredit.customerName} ka credit fully cleared.`,
                  });
                },
              }
            );
          } else {
            const remaining = outstanding - received;
            updateCredit.mutate(
              { id: selectedCredit.id, data: { amount: remaining } },
              {
                onSuccess: () => {
                  invalidateAll();
                  setPaymentDialogOpen(false);
                  setSelectedCredit(null);
                  toast({
                    title: "Partial payment received!",
                    description: `${formatCurrency(received)} receive hua. Baki bakaya: ${formatCurrency(remaining)}`,
                  });
                },
              }
            );
          }
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.error || "Failed to record payment.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleMarkPaid = (id: number) => {
    updateCredit.mutate(
      { id, data: { status: "paid" } },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Marked as paid" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCredit.mutate(
      { id },
      {
        onSuccess: () => {
          invalidateAll();
          toast({ title: "Credit deleted" });
        },
      }
    );
  };

  const totalGiven =
    credits
      ?.filter((c) => c.type === "given" && c.status === "pending")
      .reduce((sum, c) => sum + c.amount, 0) ?? 0;
  const totalReceived =
    credits
      ?.filter((c) => c.type === "received" && c.status === "pending")
      .reduce((sum, c) => sum + c.amount, 0) ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Credits / Khata</h1>
          <p className="text-xs text-muted-foreground">Track customer credit accounts</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-credit">
          <Plus className="h-4 w-4 mr-1" />
          Add Credit
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs text-red-600 font-medium">Pending Given</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalGiven)}</p>
            <p className="text-[10px] text-red-400 mt-0.5">Customer owes you</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-xs text-green-600 font-medium">Pending Received</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalReceived)}</p>
            <p className="text-[10px] text-green-400 mt-0.5">You owe customer</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4 grid grid-cols-3">
            <TabsTrigger value="given" data-testid="tab-given">
              Given
              {givenCredits.filter((c) => c.status === "pending").length > 0 && (
                <span className="ml-1 bg-red-100 text-red-700 text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                  {givenCredits.filter((c) => c.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="received" data-testid="tab-received">
              Received
              {receivedCredits.filter((c) => c.status === "pending").length > 0 && (
                <span className="ml-1 bg-green-100 text-green-700 text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                  {receivedCredits.filter((c) => c.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Customers
            </TabsTrigger>
          </TabsList>

          {/* ── Given tab ── */}
          <TabsContent value="given" className="space-y-2 mt-0">
            {filteredGiven.some((c) => c.status === "pending") && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-2">
                <ArrowDownCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>"Receive" dabao jab customer paisa dey — cash ya digital mein add ho jayega.</span>
              </div>
            )}
            {/* Paid history toggle */}
            {paidGivenCount > 0 && (
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 pb-1"
                onClick={() => setShowPaidGiven((v) => !v)}
              >
                {showPaidGiven ? (
                  <><EyeOff className="h-3.5 w-3.5" /> Paid credits chhupao ({paidGivenCount})</>
                ) : (
                  <><Eye className="h-3.5 w-3.5" /> Paid history bhi dikhao ({paidGivenCount})</>
                )}
              </button>
            )}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredGiven.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {givenCredits.length > 0
                    ? "Sab credits paid ho gaye! 🎉"
                    : "Koi given credit nahi"}
                </p>
                {givenCredits.length > 0 && !showPaidGiven && (
                  <button
                    className="text-xs text-primary mt-2 underline"
                    onClick={() => setShowPaidGiven(true)}
                  >
                    History dekhein
                  </button>
                )}
              </div>
            ) : (
              filteredGiven
                .slice()
                .sort((a, b) => {
                  if (a.status === "pending" && b.status !== "pending") return -1;
                  if (a.status !== "pending" && b.status === "pending") return 1;
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                })
                .map((credit) => (
                  <CreditCard
                    key={credit.id}
                    credit={credit}
                    onMarkPaid={handleMarkPaid}
                    onDelete={handleDelete}
                    onReceivePayment={openReceivePayment}
                  />
                ))
            )}
          </TabsContent>

          {/* ── Received tab ── */}
          <TabsContent value="received" className="space-y-2 mt-0">
            {/* Received balance card */}
            {receivedCredits.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-[11px] text-orange-600 font-medium">Aap ko dena hai</p>
                  <p className="text-base font-bold text-orange-700">{formatCurrency(totalReceived)}</p>
                  <p className="text-[10px] text-orange-400">Pending amount</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[11px] text-slate-600 font-medium">Cleared</p>
                  <p className="text-base font-bold text-slate-700">
                    {formatCurrency(
                      receivedCredits
                        .filter((c) => c.status === "paid")
                        .reduce((s, c) => s + c.amount, 0)
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400">{paidReceivedCount} paid</p>
                </div>
              </div>
            )}
            {/* Paid history toggle */}
            {paidReceivedCount > 0 && (
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 pb-1"
                onClick={() => setShowPaidReceived((v) => !v)}
              >
                {showPaidReceived ? (
                  <><EyeOff className="h-3.5 w-3.5" /> Paid credits chhupao ({paidReceivedCount})</>
                ) : (
                  <><Eye className="h-3.5 w-3.5" /> Paid history bhi dikhao ({paidReceivedCount})</>
                )}
              </button>
            )}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : receivedCredits.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Koi received credit nahi</p>
                <p className="text-xs mt-1">Yahan woh credits show hote hain jo aap ne kisi se liye hain</p>
              </div>
            ) : filteredReceived.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="font-medium text-green-600">Sab cleared! 🎉</p>
                <p className="text-xs mt-1">Koi pending received credit nahi</p>
                {!showPaidReceived && (
                  <button
                    className="text-xs text-primary mt-2 underline"
                    onClick={() => setShowPaidReceived(true)}
                  >
                    History dekhein
                  </button>
                )}
              </div>
            ) : (
              filteredReceived
                .slice()
                .sort((a, b) => {
                  if (a.status === "pending" && b.status !== "pending") return -1;
                  if (a.status !== "pending" && b.status === "pending") return 1;
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                })
                .map((credit) => (
                  <CreditCard
                    key={credit.id}
                    credit={credit}
                    onMarkPaid={handleMarkPaid}
                    onDelete={handleDelete}
                    onReceivePayment={openReceivePayment}
                  />
                ))
            )}
          </TabsContent>

          {/* ── Customers report tab ── */}
          <TabsContent value="customers" className="mt-0">
            <div className="mb-3">
              <Input
                placeholder="Customer name search karo..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-customer-search"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-card border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {reportSearch ? "Koi customer nahi mila" : "Abhi koi credit nahi"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1 mb-2">
                  {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} — tap to expand
                </p>
                {filteredCustomers.map(([name, customerCredits]) => (
                  <CustomerReportCard
                    key={name}
                    customerName={name}
                    credits={customerCredits}
                    onMarkPaid={handleMarkPaid}
                    onDelete={handleDelete}
                    onReceivePayment={openReceivePayment}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Receive Payment Dialog ─── */}
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(o) => {
          setPaymentDialogOpen(o);
          if (!o) setSelectedCredit(null);
        }}
      >
        <DialogContent className="sm:max-w-sm" data-testid="receive-payment-dialog">
          <DialogHeader>
            <DialogTitle className="text-green-700 flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5" />
              Receive Payment
            </DialogTitle>
            <DialogDescription>
              {selectedCredit?.customerName} — Outstanding:{" "}
              <span className="font-bold text-red-600">
                {formatCurrency(selectedCredit?.amount ?? 0)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onReceivePayment)} className="space-y-4">
              {/* Quick amount buttons */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Quick Amount</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 text-sm"
                    onClick={() =>
                      paymentForm.setValue(
                        "amountReceived",
                        Math.round((selectedCredit?.amount ?? 0) / 2)
                      )
                    }
                    data-testid="button-half-payment"
                  >
                    Half — {formatCurrency(Math.round((selectedCredit?.amount ?? 0) / 2))}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 text-sm border-green-300 text-green-700"
                    onClick={() =>
                      paymentForm.setValue("amountReceived", selectedCredit?.amount ?? 0)
                    }
                    data-testid="button-full-payment"
                  >
                    Full — {formatCurrency(selectedCredit?.amount ?? 0)}
                  </Button>
                </div>
              </div>

              {/* Custom amount */}
              <FormField
                control={paymentForm.control}
                name="amountReceived"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Received (Rs)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="text-lg font-bold h-12"
                        {...field}
                        data-testid="input-payment-amount"
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value > 0 && selectedCredit && field.value < selectedCredit.amount && (
                      <p className="text-xs text-amber-600 mt-1">
                        Partial payment — Baki rahega:{" "}
                        <strong>{formatCurrency(selectedCredit.amount - Number(field.value))}</strong>
                      </p>
                    )}
                    {field.value > 0 && selectedCredit && Number(field.value) >= selectedCredit.amount && (
                      <p className="text-xs text-green-600 mt-1">
                        Full payment — Credit mark as <strong>Paid</strong> ho jayega ✓
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* Payment method */}
              <FormField
                control={paymentForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paisa kahan receive hua?</FormLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`flex items-center gap-2 justify-center border rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                          field.value === "cash"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-accent"
                        }`}
                        onClick={() => field.onChange("cash")}
                        data-testid="payment-method-cash"
                      >
                        <Banknote className="h-4 w-4" />
                        Cash
                      </button>
                      <button
                        type="button"
                        className={`flex items-center gap-2 justify-center border rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                          field.value === "digital"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-card hover:bg-accent"
                        }`}
                        onClick={() => field.onChange("digital")}
                        data-testid="payment-method-digital"
                      >
                        <Smartphone className="h-4 w-4" />
                        Digital
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {field.value === "cash"
                        ? "Yeh amount Cash balance mein add ho jayega"
                        : "Yeh amount Digital balance mein add ho jayega"}
                    </p>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                disabled={createEntry.isPending || updateCredit.isPending}
                data-testid="button-confirm-payment"
              >
                {(createEntry.isPending || updateCredit.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Payment Record Karo
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── Add Credit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="add-credit-dialog">
          <DialogHeader>
            <DialogTitle>Add Credit Entry</DialogTitle>
            <DialogDescription>Customer ka credit record add karo</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Customer name..."
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setCustomerSearch(e.target.value);
                        }}
                        list="credit-customer-suggestions"
                        data-testid="input-credit-customer"
                      />
                    </FormControl>
                    <datalist id="credit-customer-suggestions">
                      {customers?.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="0300-1234567"
                          className="pl-9"
                          {...field}
                          data-testid="input-credit-phone"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-credit-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="given">Given — Customer owes you</SelectItem>
                        <SelectItem value="received">Received — You owe customer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        data-testid="input-credit-amount"
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
                      <Input
                        placeholder="What is this credit for?"
                        {...field}
                        data-testid="input-credit-description"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-credit-due-date" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={createCredit.isPending}
                data-testid="button-submit-credit"
              >
                {createCredit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Credit
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
