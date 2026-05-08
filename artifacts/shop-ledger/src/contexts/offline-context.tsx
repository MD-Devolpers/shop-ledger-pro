import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { offlineDb } from "@/lib/offline-db";

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  syncNow: async () => {},
});

export function useOffline() {
  return useContext(OfflineContext);
}

const API_WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const queryClient = useQueryClient();
  const interceptorInstalled = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const count = await offlineDb.syncQueue.where("status").anyOf(["pending", "failed"]).count();
    setPendingCount(count);
  }, []);

  const processQueue = useCallback(async () => {
    const items = await offlineDb.syncQueue
      .where("status")
      .anyOf(["pending", "failed"])
      .toArray();

    if (items.length === 0) return;

    setIsSyncing(true);

    for (const item of items) {
      if (!navigator.onLine) break;
      try {
        await offlineDb.syncQueue.update(item.id!, { status: "syncing" });
        const headers: Record<string, string> = JSON.parse(item.headers || "{}");
        await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json", ...headers },
          body: item.body ?? undefined,
          credentials: "include",
        });
        await offlineDb.syncQueue.delete(item.id!);
      } catch {
        await offlineDb.syncQueue.update(item.id!, {
          status: "failed",
          retries: (item.retries ?? 0) + 1,
        });
      }
    }

    await refreshPendingCount();
    setIsSyncing(false);
    queryClient.invalidateQueries();
  }, [queryClient, refreshPendingCount]);

  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    await processQueue();
  }, [isOnline, isSyncing, processQueue]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await processQueue();
      queryClient.invalidateQueries();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [processQueue, queryClient]);

  useEffect(() => {
    if (interceptorInstalled.current) return;
    interceptorInstalled.current = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const isApiWrite =
        API_WRITE_METHODS.includes(method) &&
        (url.includes("/api/") || url.startsWith("/api"));

      if (!navigator.onLine && isApiWrite) {
        const body =
          init?.body != null
            ? typeof init.body === "string"
              ? init.body
              : JSON.stringify(init.body)
            : null;

        await offlineDb.syncQueue.add({
          method,
          url,
          body,
          headers: JSON.stringify({}),
          createdAt: new Date().toISOString(),
          status: "pending",
          retries: 0,
        });

        await refreshPendingCount();

        return new Response(
          JSON.stringify({ offline: true, queued: true }),
          {
            status: 202,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [refreshPendingCount]);

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing, pendingCount, syncNow }}>
      {children}
    </OfflineContext.Provider>
  );
}
