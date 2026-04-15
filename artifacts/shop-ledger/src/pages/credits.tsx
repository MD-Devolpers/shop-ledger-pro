import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCredits,
  useCreateCredit,
  useUpdateCredit,
  useDeleteCredit,
  useListCustomers,
  getListCreditsQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Users, Plus, Loader2, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(amount);
}

const creditSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().optional(),
  type: z.enum(["given", "received"]),
  dueDate: z.string().optional(),
});

type Credit = {
  id: number;
  customerName: string;
  amount: number;
  description?: string | null;
  type: string;
  status: string;
  dueDate?: string | null;
  createdAt: string;
};

function CreditCard({
  credit,
  onMarkPaid,
  onDelete,
}: {
  credit: Credit;
  onMarkPaid: (id: number) => void;
  onDelete: (id: number) => void;
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
                credit.type === "given" ? "text-red-600 border-red-200" : "text-green-600 border-green-200"
              }`}
            >
              {credit.type === "given" ? "Given" : "Received"}
            </Badge>
          </div>
          {credit.description && <p className="text-sm text-muted-foreground mt-0.5">{credit.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(credit.createdAt), "MMM d, yyyy")}
            {credit.dueDate && ` · Due: ${format(new Date(credit.dueDate), "MMM d, yyyy")}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className={`font-bold text-base ${credit.type === "given" ? "text-red-600" : "text-green-600"}`}>
            {formatCurrency(credit.amount)}
          </p>
          <div className="flex gap-1">
            {credit.status === "pending" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => onMarkPaid(credit.id)}
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

export default function Credits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("given");
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => { document.title = "Credits - Daily Shop Ledger"; }, []);

  const { data: credits, isLoading } = useListCredits();
  const { data: customers } = useListCustomers({ q: customerSearch });
  const createCredit = useCreateCredit();
  const updateCredit = useUpdateCredit();
  const deleteCredit = useDeleteCredit();

  const form = useForm<z.infer<typeof creditSchema>>({
    resolver: zodResolver(creditSchema),
    defaultValues: { customerName: "", amount: 0, description: "", type: "given", dueDate: "" },
  });

  const filteredCredits = credits?.filter((c) => c.type === tab) ?? [];

  const onSubmit = (data: z.infer<typeof creditSchema>) => {
    createCredit.mutate(
      { data: { customerName: data.customerName, amount: data.amount, description: data.description || null, type: data.type, dueDate: data.dueDate || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCreditsQueryKey() });
          setDialogOpen(false);
          form.reset();
          toast({ title: "Credit entry added" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.error || "Failed to add credit.", variant: "destructive" });
        },
      }
    );
  };

  const handleMarkPaid = (id: number) => {
    updateCredit.mutate(
      { id, data: { status: "paid" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCreditsQueryKey() });
          toast({ title: "Marked as paid" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCredit.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCreditsQueryKey() });
        toast({ title: "Credit deleted" });
      },
    });
  };

  const totalGiven = credits?.filter((c) => c.type === "given" && c.status === "pending").reduce((sum, c) => sum + c.amount, 0) ?? 0;
  const totalReceived = credits?.filter((c) => c.type === "received" && c.status === "pending").reduce((sum, c) => sum + c.amount, 0) ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Credits</h1>
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
            <p className="text-xs text-red-600 font-medium">Given (Pending)</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(totalGiven)}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-xs text-green-600 font-medium">Received (Pending)</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(totalReceived)}</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full mb-4 grid grid-cols-2">
            <TabsTrigger value="given" data-testid="tab-given">Given</TabsTrigger>
            <TabsTrigger value="received" data-testid="tab-received">Received</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-2 mt-0">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-card border rounded-xl animate-pulse" />)}
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No {tab} credits yet</p>
              </div>
            ) : (
              filteredCredits.map((credit) => (
                <CreditCard
                  key={credit.id}
                  credit={credit}
                  onMarkPaid={handleMarkPaid}
                  onDelete={handleDelete}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Credit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="add-credit-dialog">
          <DialogHeader>
            <DialogTitle>Add Credit Entry</DialogTitle>
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
                        onChange={(e) => { field.onChange(e); setCustomerSearch(e.target.value); }}
                        list="credit-customer-suggestions"
                        data-testid="input-credit-customer"
                      />
                    </FormControl>
                    <datalist id="credit-customer-suggestions">
                      {customers?.map((c) => <option key={c.id} value={c.name} />)}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-credit-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="given">Given (You gave credit)</SelectItem>
                        <SelectItem value="received">Received (You got credit)</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <Input type="number" placeholder="0" {...field} data-testid="input-credit-amount" />
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
                      <Input placeholder="What is this credit for?" {...field} data-testid="input-credit-description" />
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
              <Button type="submit" className="w-full" disabled={createCredit.isPending} data-testid="button-submit-credit">
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
