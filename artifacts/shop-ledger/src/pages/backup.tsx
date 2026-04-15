import { useEffect, useState } from "react";
import { useExportBackup } from "@workspace/api-client-react";
import { Download, DatabaseBackup, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Backup() {
  const { toast } = useToast();
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const { data: backupData, refetch, isFetching } = useExportBackup({ query: { enabled: false } });

  useEffect(() => {
    document.title = "Backup - Daily Shop Ledger";
    const saved = localStorage.getItem("lastBackupDate");
    if (saved) setLastBackup(saved);
  }, []);

  const handleDownload = async () => {
    const result = await refetch();
    if (result.data) {
      const json = JSON.stringify(result.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shop-ledger-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem("lastBackupDate", now);
      setLastBackup(now);
      toast({ title: "Backup downloaded!", description: "Your data has been saved to a file." });
    } else {
      toast({ title: "Error", description: "Could not download backup.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Manual Backup</h1>
        <p className="text-xs text-muted-foreground">Download all your data as a file</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <DatabaseBackup className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Export Backup</CardTitle>
                <CardDescription>Download all entries, credits, and account data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Last backup: {format(new Date(lastBackup), "MMM d, yyyy 'at' h:mm a")}</span>
              </div>
            )}

            <Button
              className="w-full h-12 text-base"
              onClick={handleDownload}
              disabled={isFetching}
              data-testid="button-download-backup"
            >
              <Download className="mr-2 h-5 w-5" />
              {isFetching ? "Preparing backup..." : "Download Backup (JSON)"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's included in backup?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>All ledger entries (Cash In/Out)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>All credit records with customer names</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Profit data for all entries</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Account information</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
