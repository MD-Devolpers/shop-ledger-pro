import { useOffline } from "@/contexts/offline-context";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncStatus() {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline();

  if (isSyncing) {
    return (
      <button
        disabled
        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700"
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        Syncing...
      </button>
    );
  }

  if (!isOnline) {
    return (
      <button
        onClick={syncNow}
        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700"
      >
        <WifiOff className="h-3 w-3" />
        Offline{pendingCount > 0 ? ` · ${pendingCount}` : ""}
      </button>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={syncNow}
        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 animate-pulse"
      >
        <RefreshCw className="h-3 w-3" />
        {pendingCount} pending
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
      <CheckCircle2 className="h-3 w-3" />
      Synced
    </span>
  );
}

export function OfflineBanner() {
  const { isOnline, pendingCount } = useOffline();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        Aap offline hain — data locally save ho raha hai
        {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
      </span>
    </div>
  );
}
