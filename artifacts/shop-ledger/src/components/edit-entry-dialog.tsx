import { useQueryClient } from "@tanstack/react-query";
import { useGetEntry, useUpdateEntry, useListCustomers, getGetEntryQueryKey } from "@workspace/api-client-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const schema = z.object({
  type: z.enum(["cash_in", "cash_out"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().optional(),
  paymentMethod: z.enum(["cash", "digital"]),
  isCredit: z.boolean(),
  customerName: z.string().optional(),
});

export default function EditEntryDialog({
  entryId,
  onClose,
  onSuccess,
}: {
  entryId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [customerSearch, setCustomerSearch] = useState("");
  const { data: entry, isLoading } = useGetEntry(entryId, {
    query: { queryKey: getGetEntryQueryKey(entryId) },
  });
  const { data: customers } = useListCustomers({ q: customerSearch });
  const updateEntry = useUpdateEntry();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: entry
      ? {
          type: entry.type as "cash_in" | "cash_out",
          amount: entry.amount,
          description: entry.description ?? "",
          paymentMethod: entry.paymentMethod as "cash" | "digital",
          isCredit: entry.isCredit,
          customerName: entry.customerName ?? "",
        }
      : undefined,
  });

  const isCredit = form.watch("isCredit");

  const onSubmit = (data: z.infer<typeof schema>) => {
    updateEntry.mutate(
      {
        id: entryId,
        data: {
          type: data.type,
          amount: data.amount,
          description: data.description || null,
          paymentMethod: data.paymentMethod,
          isCredit: data.isCredit,
          customerName: data.isCredit ? (data.customerName || null) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Entry updated successfully" });
          onSuccess();
        },
        onError: (error) => {
          toast({ title: "Error", description: error.error || "Failed to update.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="edit-entry-dialog">
        <DialogHeader>
          <DialogTitle>Edit Entry</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash_in">Cash In</SelectItem>
                        <SelectItem value="cash_out">Cash Out</SelectItem>
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
                      <Input type="number" {...field} data-testid="edit-input-amount" />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Description..." {...field} data-testid="edit-input-description" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="digital">Digital Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
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
                    />
                    <span className="text-sm">Mark as Credit</span>
                  </label>
                )}
              />
              {isCredit && (
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
                          list="edit-customer-suggestions"
                        />
                      </FormControl>
                      <datalist id="edit-customer-suggestions">
                        {customers?.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </FormItem>
                  )}
                />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updateEntry.isPending} data-testid="button-save-edit">
                  {updateEntry.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
