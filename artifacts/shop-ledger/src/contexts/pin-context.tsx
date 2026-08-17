/**
 * PinContext — manages inventory PIN unlock state.
 * One correct PIN unlocks ALL protected sections for `unlockDuration` minutes (configurable).
 * Unlock state is stored in sessionStorage so it survives page refresh in same tab.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const UNLOCK_STORAGE_KEY = "inv_pin_unlocked_at";

interface PinContextValue {
  /** Pages that require PIN (fetched from server) */
  protectedPages: string[];
  /** Whether a PIN is configured */
  pinSet: boolean;
  /** Unlock duration in minutes */
  unlockDuration: number;
  /** Load state */
  loading: boolean;
  /** Check if the PIN lock is currently open */
  isUnlocked: () => boolean;
  /** Call after successful PIN verification */
  unlock: () => void;
  /** Manually lock again */
  lock: () => void;
  /** Check if a specific page key is protected */
  isProtected: (pageKey: string) => boolean;
  /** Refetch settings (e.g. after admin changes them) */
  refetch: () => void;
}

const PinContext = createContext<PinContextValue | null>(null);

export function PinProvider({ children }: { children: React.ReactNode }) {
  const [protectedPages, setProtectedPages] = useState<string[]>([]);
  const [pinSet, setPinSet] = useState(false);
  const [unlockDuration, setUnlockDuration] = useState(10);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory/pin-settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProtectedPages(data.protectedPages ?? []);
        setPinSet(data.pinSet ?? false);
        setUnlockDuration(data.unlockDuration ?? 10);
      }
    } catch {
      // Network error — assume no protection
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const isUnlocked = useCallback((): boolean => {
    const raw = sessionStorage.getItem(UNLOCK_STORAGE_KEY);
    if (!raw) return false;
    const unlockedAt = parseInt(raw, 10);
    return Date.now() - unlockedAt < unlockDuration * 60 * 1000;
  }, [unlockDuration]);

  const unlock = useCallback(() => {
    sessionStorage.setItem(UNLOCK_STORAGE_KEY, String(Date.now()));
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
  }, []);

  const isProtected = useCallback((pageKey: string): boolean => {
    if (!pinSet) return false;
    return protectedPages.includes(pageKey);
  }, [protectedPages, pinSet]);

  return (
    <PinContext.Provider value={{ protectedPages, pinSet, unlockDuration, loading, isUnlocked, unlock, lock, isProtected, refetch: fetchSettings }}>
      {children}
    </PinContext.Provider>
  );
}

export function usePinContext() {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error("usePinContext must be used inside PinProvider");
  return ctx;
}
