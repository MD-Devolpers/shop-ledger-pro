import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, ArrowRightLeft, Download } from "lucide-react";
import { format } from "date-fns";

export type ReceiptData = {
  storeName: string;
  transactionType: "Fund Transfer" | "Fund Receive";
  amount: number;
  customerName?: string | null;
  contactNumber?: string | null;
  description?: string | null;
  date: Date;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function generateReceiptNo() {
  return "TXN" + Date.now().toString().slice(-8);
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

export default function ReceiptModal({ open, onClose, data }: ReceiptModalProps) {
  if (!data) return null;

  const receiptNo = generateReceiptNo();
  const isTransfer = data.transactionType === "Fund Transfer";

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        {/* Action buttons — hidden on print */}
        <div className="flex items-center justify-between px-4 py-3 border-b print:hidden">
          <p className="text-sm font-semibold text-muted-foreground">Receipt Generated</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Receipt body */}
        <div
          id="receipt-content"
          className="bg-white p-5 font-mono text-sm"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {/* Store Header */}
          <div className="text-center mb-4">
            <p className="text-base font-bold uppercase tracking-widest">{data.storeName}</p>
            <p className="text-xs text-gray-500 mt-0.5">LedgerEntries — ledgerentries.com</p>
            <div className="border-t border-dashed border-gray-400 mt-3 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">Payment Receipt</p>
          </div>

          {/* Receipt Info */}
          <div className="space-y-1.5 text-xs mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Receipt No:</span>
              <span className="font-semibold">{receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date:</span>
              <span className="font-semibold">{format(data.date, "dd MMM yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time:</span>
              <span className="font-semibold">{format(data.date, "hh:mm a")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type:</span>
              <span className={`font-semibold ${isTransfer ? "text-violet-700" : "text-blue-700"}`}>
                {data.transactionType}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 mb-4" />

          {/* Amount — big */}
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Amount</p>
            <p className={`text-3xl font-bold ${isTransfer ? "text-violet-700" : "text-blue-700"}`}>
              {formatCurrency(data.amount)}
            </p>
          </div>

          <div className="border-t border-dashed border-gray-400 mb-4" />

          {/* Customer Details */}
          {(data.customerName || data.contactNumber || data.description) && (
            <div className="space-y-1.5 text-xs mb-4">
              <p className="text-gray-500 uppercase tracking-wide font-semibold text-[10px] mb-2">
                {isTransfer ? "Recipient Details" : "Sender Details"}
              </p>
              {data.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-semibold text-right max-w-[60%] truncate">{data.customerName}</span>
                </div>
              )}
              {data.contactNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact:</span>
                  <span className="font-semibold">{data.contactNumber}</span>
                </div>
              )}
              {data.description && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 flex-shrink-0">Notes:</span>
                  <span className="font-semibold text-right">{data.description}</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 mb-4" />

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400 space-y-0.5">
            <p>Payment Method: Digital</p>
            <p className="font-semibold text-gray-600">Thank you for your business!</p>
            <p className="mt-2">*** Powered by LedgerEntries ***</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
