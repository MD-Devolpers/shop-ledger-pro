/**
 * PinModal — 4-digit PIN entry dialog with numpad + keyboard support.
 * Calls onSuccess() after correct PIN is verified with the server.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Lock, Delete, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePinContext } from "@/contexts/pin-context";

interface PinModalProps {
  onSuccess: () => void;
  onDismiss?: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

async function verifyPin(pin: string): Promise<boolean> {
  const res = await fetch("/api/inventory/pin-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ pin }),
  });
  return res.ok;
}

export default function PinModal({ onSuccess, onDismiss }: PinModalProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDigits, setShowDigits] = useState(false);
  const [shake, setShake] = useState(false);
  const { unlock } = usePinContext();
  const submitRef = useRef(false);

  const addDigit = useCallback((d: string) => {
    if (loading) return;
    setError("");
    setDigits(prev => prev.length < 4 ? [...prev, d] : prev);
  }, [loading]);

  const removeDigit = useCallback(() => {
    setError("");
    setDigits(prev => prev.slice(0, -1));
  }, []);

  const handleKey = useCallback((key: string) => {
    if (key === "⌫") removeDigit();
    else if (/^\d$/.test(key)) addDigit(key);
  }, [addDigit, removeDigit]);

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace") removeDigit();
      else if (/^\d$/.test(e.key)) addDigit(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addDigit, removeDigit]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (digits.length === 4 && !submitRef.current) {
      submitRef.current = true;
      setLoading(true);
      verifyPin(digits.join("")).then(ok => {
        if (ok) {
          unlock();
          onSuccess();
        } else {
          setError("Incorrect PIN — please try again");
          setShake(true);
          setTimeout(() => { setShake(false); setDigits([]); submitRef.current = false; }, 500);
        }
        setLoading(false);
      }).catch(() => {
        setError("Network error — please try again");
        setDigits([]);
        submitRef.current = false;
        setLoading(false);
      });
    }
  }, [digits, unlock, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-b from-teal-600 to-teal-700 px-6 py-5 text-center text-white">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center">
              <Lock className="h-7 w-7 text-white" />
            </div>
          </div>
          <h2 className="text-lg font-bold">Inventory PIN</h2>
          <p className="text-teal-100 text-sm mt-0.5">Enter your 4-digit security PIN</p>
        </div>

        {/* PIN dots */}
        <div className="px-6 pt-5 pb-3">
          <div className={`flex justify-center gap-4 mb-1 ${shake ? "animate-shake" : ""}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                  i < digits.length
                    ? "bg-teal-600 border-teal-600 scale-110"
                    : "bg-transparent border-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          {showDigits && digits.length > 0 && (
            <p className="text-center text-2xl font-mono font-bold tracking-[0.5em] text-teal-700 mt-2">
              {digits.join("")}
            </p>
          )}
          <div className="flex justify-center mt-1">
            <button
              onClick={() => setShowDigits(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showDigits ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showDigits ? "Hide" : "Show"}
            </button>
          </div>
          {error && (
            <p className="text-center text-sm text-red-600 mt-2 font-medium">{error}</p>
          )}
          {loading && (
            <p className="text-center text-sm text-teal-600 mt-2">Verifying...</p>
          )}
        </div>

        {/* Numpad */}
        <div className="px-4 pb-5 grid grid-cols-3 gap-2">
          {KEYS.map((k, i) => {
            if (k === "") return <div key={i} />;
            if (k === "⌫") {
              return (
                <button
                  key={i}
                  onMouseDown={e => { e.preventDefault(); removeDigit(); }}
                  disabled={loading}
                  className="h-14 rounded-xl bg-muted hover:bg-muted/70 active:bg-muted/50 flex items-center justify-center transition-colors"
                >
                  <Delete className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            }
            return (
              <button
                key={i}
                onMouseDown={e => { e.preventDefault(); handleKey(k); }}
                disabled={loading || digits.length >= 4}
                className="h-14 rounded-xl bg-muted hover:bg-teal-50 hover:text-teal-700 active:bg-teal-100 text-xl font-semibold transition-colors disabled:opacity-40"
              >
                {k}
              </button>
            );
          })}
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <div className="border-t px-4 py-3 text-center">
            <button onClick={onDismiss} className="text-sm text-muted-foreground hover:text-foreground">
              Go Back
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
