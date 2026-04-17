import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Download, Loader2, ImageDown } from "lucide-react";
import { format } from "date-fns";
import html2canvas from "html2canvas";

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

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

export default function ReceiptModal({ open, onClose, data }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const receiptNo = useRef("TXN" + Date.now().toString().slice(-8));

  if (!data) return null;

  const isTransfer = data.transactionType === "Fund Transfer";
  const fileName = `receipt-${data.transactionType.replace(" ", "_")}-${format(data.date, "yyyyMMdd-HHmmss")}.jpg`;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveJpg = async () => {
    if (!receiptRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to save receipt as image", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        {/* Action buttons — hidden on print */}
        <div className="flex items-center justify-between px-4 py-3 border-b print:hidden">
          <p className="text-sm font-semibold text-muted-foreground">Receipt</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handleSaveJpg}
              disabled={saving}
            >
              {saving
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <ImageDown className="h-3.5 w-3.5" />}
              {saving ? "Saving..." : "Save JPG"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Receipt body — captured by html2canvas */}
        <div
          ref={receiptRef}
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
              <span className="font-semibold">{receiptNo.current}</span>
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
              <span
                className="font-semibold"
                style={{ color: isTransfer ? "#6d28d9" : "#1d4ed8" }}
              >
                {data.transactionType}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 mb-4" />

          {/* Amount — big */}
          <div className="text-center mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Amount</p>
            <p
              className="text-3xl font-bold"
              style={{ color: isTransfer ? "#6d28d9" : "#1d4ed8" }}
            >
              {formatCurrency(data.amount)}
            </p>
          </div>

          <div className="border-t border-dashed border-gray-400 mb-4" />

          {/* Customer Details */}
          {(data.customerName || data.contactNumber || data.description) && (
            <div className="space-y-1.5 text-xs mb-4">
              <p
                className="uppercase tracking-wide font-semibold mb-2"
                style={{ fontSize: "10px", color: "#6b7280" }}
              >
                {isTransfer ? "Recipient Details" : "Sender Details"}
              </p>
              {data.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-semibold text-right" style={{ maxWidth: "60%" }}>
                    {data.customerName}
                  </span>
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
          <div className="text-center space-y-0.5" style={{ fontSize: "10px", color: "#9ca3af" }}>
            <p>Payment Method: Digital</p>
            <p className="font-semibold" style={{ color: "#4b5563" }}>Thank you for your business!</p>
            <p className="mt-2">*** Powered by LedgerEntries ***</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
