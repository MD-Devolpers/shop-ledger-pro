/**
 * PinGuard — wraps a protected page/section.
 * If the page key is in the protected list and PIN is not unlocked, shows PinModal.
 * Otherwise renders children normally.
 */
import { useState, useEffect, useCallback } from "react";
import { usePinContext } from "@/contexts/pin-context";
import PinModal from "@/components/pin-modal";
import { useLocation } from "wouter";

interface PinGuardProps {
  pageKey: string;
  children: React.ReactNode;
}

export default function PinGuard({ pageKey, children }: PinGuardProps) {
  const { isProtected, isUnlocked, loading } = usePinContext();
  const [showModal, setShowModal] = useState(false);
  const [, navigate] = useLocation();

  // Determine if we need PIN on every render cycle
  const needsPin = !loading && isProtected(pageKey) && !isUnlocked();

  // Show modal when protection kicks in
  useEffect(() => {
    if (needsPin) setShowModal(true);
  }, [needsPin]);

  // Re-check every 30 seconds (catches TTL expiry while on page)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isProtected(pageKey) && !isUnlocked()) {
        setShowModal(true);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isProtected, isUnlocked, pageKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <>
      {/* Always render children so state isn't lost when unlocked */}
      <div className={showModal && needsPin ? "invisible pointer-events-none select-none" : ""}>
        {children}
      </div>

      {showModal && needsPin && (
        <PinModal
          onSuccess={() => setShowModal(false)}
          onDismiss={() => navigate("/inventory")}
        />
      )}
    </>
  );
}
