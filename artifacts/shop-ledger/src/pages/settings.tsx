import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  Globe, LogOut, User, Shield, ShieldCheck, CheckCircle2,
  XCircle, Crown, Mail, Lock, KeyRound, Loader2, Eye, EyeOff, Pencil,
  ToggleLeft, ToggleRight, Timer, RefreshCw, ChevronDown, ChevronUp,
  ShieldOff, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPinSettings,
  useUpdatePinSettings,
  useSetPin,
  useChangePin,
  useRemovePin,
  usePinResetRequest,
  usePinResetVerify,
} from "@/lib/inventory-api";
import { usePinContext } from "@/contexts/pin-context";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
];

// All inventory pages available for PIN protection
const PROTECTABLE_PAGES = [
  { key: "products",             label: "Products",         desc: "Product list and stock" },
  { key: "bulk-purchase",        label: "Bulk Purchase",    desc: "Purchase / buying records" },
  { key: "purchase-bills",       label: "Purchase Report",  desc: "Bill history & reports" },
  { key: "product-sale",         label: "Product Sale",     desc: "Create and view sales" },
  { key: "product-return",       label: "Product Return",   desc: "Return transactions" },
  { key: "product-reports",      label: "Product Reports",  desc: "Sales & profit analytics" },
  { key: "company-replacements", label: "Replacements",     desc: "Company replacement tracking" },
  { key: "supplier-balance",     label: "Supplier Balance", desc: "Supplier dues & payments" },
];

const DURATION_OPTIONS = [
  { value: 5,   label: "5 min" },
  { value: 10,  label: "10 min" },
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 0,   label: "Custom" },
];

// ── PIN input (4 boxes) ──────────────────────────────────────────────────────

function PinInput({ value, onChange, label, id }: { value: string; onChange: (v: string) => void; label: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="password"
        inputMode="numeric"
        maxLength={4}
        placeholder="••••"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange(v);
        }}
        autoComplete="off"
        className="tracking-[0.5em] text-center font-mono text-lg h-11"
      />
    </div>
  );
}

// ── OTP input (6 boxes) ──────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">6-Digit Verification Code</Label>
      <Input
        type="text"
        inputMode="numeric"
        maxLength={6}
        placeholder="• • • • • •"
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(v);
        }}
        autoComplete="one-time-code"
        className="tracking-[0.5em] text-center font-mono text-lg h-11"
      />
    </div>
  );
}

// ── PIN Security card component ───────────────────────────────────────────────

function PinSecurityCard() {
  const { toast } = useToast();
  const { refetch: refetchContext } = usePinContext();
  const { data: pinData, refetch: refetchPin } = useGetPinSettings();
  const updateSettings = useUpdatePinSettings();
  const setPin = useSetPin();
  const changePin = useChangePin();
  const removePin = useRemovePin();
  const resetRequest = usePinResetRequest();
  const resetVerify = usePinResetVerify();

  const pinSet = pinData?.pinSet ?? false;
  const protectedPages: string[] = pinData?.protectedPages ?? [];
  const unlockDuration: number = pinData?.unlockDuration ?? 10;

  // Gate: require current PIN to open settings panel (if PIN is set)
  const [gatePin, setGatePin] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState("");
  const [gateOpen, setGateOpen] = useState(false); // true when current PIN verified
  const [panelOpen, setPanelOpen] = useState(false); // settings panel visible (for non-PIN users)

  // When no PIN is set, panel is freely accessible
  const canViewPanel = !pinSet || gateOpen;
  const showPanel = canViewPanel && (panelOpen || !pinSet);

  // Sub-panels
  const [activePanel, setActivePanel] = useState<"set" | "change" | "remove" | "forgot" | null>(null);

  // Set PIN state
  const [newPin1, setNewPin1] = useState("");
  const [newPin2, setNewPin2] = useState("");

  // Change PIN state
  const [chCurrent, setChCurrent] = useState("");
  const [chNew, setChNew] = useState("");
  const [chConfirm, setChConfirm] = useState("");

  // Remove PIN state
  const [rmPin, setRmPin] = useState("");

  // Forgot PIN state
  const [forgotStep, setForgotStep] = useState<"request" | "verify">("request");
  const [otpCode, setOtpCode] = useState("");
  const [resetNewPin, setResetNewPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");

  // Custom duration
  const [customDuration, setCustomDuration] = useState("");
  const [showCustomDuration, setShowCustomDuration] = useState(false);

  const handleGateVerify = async () => {
    if (gatePin.length !== 4) { setGateError("Enter 4-digit PIN"); return; }
    setGateLoading(true);
    setGateError("");
    try {
      const res = await fetch("/api/inventory/pin-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: gatePin }),
        credentials: "include",
      });
      if (res.ok) {
        setGateOpen(true);
        setPanelOpen(true);
        setGatePin("");
      } else {
        const d = await res.json();
        setGateError(d.error || "Incorrect PIN");
      }
    } finally {
      setGateLoading(false);
    }
  };

  const togglePage = async (key: string) => {
    const updated = protectedPages.includes(key)
      ? protectedPages.filter((p) => p !== key)
      : [...protectedPages, key];
    await updateSettings.mutateAsync({ protectedPages: updated });
    refetchContext();
  };

  const handleDurationChange = async (mins: number) => {
    if (mins === 0) { setShowCustomDuration(true); return; }
    setShowCustomDuration(false);
    await updateSettings.mutateAsync({ unlockDuration: mins });
    refetchContext();
    toast({ title: "Unlock duration updated" });
  };

  const handleCustomDuration = async () => {
    const v = parseInt(customDuration);
    if (!v || v < 1 || v > 480) {
      toast({ title: "Enter 1–480 minutes", variant: "destructive" }); return;
    }
    await updateSettings.mutateAsync({ unlockDuration: v });
    refetchContext();
    setShowCustomDuration(false);
    setCustomDuration("");
    toast({ title: "Unlock duration updated" });
  };

  const handleSetPin = async () => {
    if (newPin1.length !== 4) { toast({ title: "PIN must be 4 digits", variant: "destructive" }); return; }
    if (newPin1 !== newPin2) { toast({ title: "PINs don't match", variant: "destructive" }); return; }
    await setPin.mutateAsync({ pin: newPin1 });
    toast({ title: "PIN set successfully", description: "Your inventory sections are now protected." });
    setNewPin1(""); setNewPin2("");
    setActivePanel(null);
    refetchPin();
    refetchContext();
  };

  const handleChangePin = async () => {
    if (chCurrent.length !== 4) { toast({ title: "Enter current PIN", variant: "destructive" }); return; }
    if (chNew.length !== 4) { toast({ title: "New PIN must be 4 digits", variant: "destructive" }); return; }
    if (chNew !== chConfirm) { toast({ title: "New PINs don't match", variant: "destructive" }); return; }
    try {
      await changePin.mutateAsync({ currentPin: chCurrent, newPin: chNew });
      toast({ title: "PIN changed successfully" });
      setChCurrent(""); setChNew(""); setChConfirm("");
      setActivePanel(null);
      refetchContext();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to change PIN", variant: "destructive" });
    }
  };

  const handleRemovePin = async () => {
    if (rmPin.length !== 4) { toast({ title: "Enter current PIN to confirm removal", variant: "destructive" }); return; }
    try {
      await removePin.mutateAsync({ currentPin: rmPin });
      toast({ title: "PIN removed", description: "Inventory sections are no longer PIN-protected." });
      setRmPin("");
      setActivePanel(null);
      setGateOpen(false);
      setPanelOpen(false);
      refetchPin();
      refetchContext();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to remove PIN", variant: "destructive" });
    }
  };

  const handleForgotRequest = async () => {
    try {
      const result = await resetRequest.mutateAsync();
      toast({ title: "Code sent!", description: result.message });
      if (result._devCode) {
        toast({ title: `[DEV] Code: ${result._devCode}`, description: "Email not configured — code shown here" });
      }
      setForgotStep("verify");
    } catch (e: any) {
      toast({ title: e?.message || "Failed to send code", variant: "destructive" });
    }
  };

  const handleForgotVerify = async () => {
    if (otpCode.length !== 6) { toast({ title: "Enter 6-digit code", variant: "destructive" }); return; }
    if (resetNewPin.length !== 4) { toast({ title: "New PIN must be 4 digits", variant: "destructive" }); return; }
    if (resetNewPin !== resetConfirmPin) { toast({ title: "PINs don't match", variant: "destructive" }); return; }
    try {
      await resetVerify.mutateAsync({ otp: otpCode, newPin: resetNewPin });
      toast({ title: "PIN reset successfully!", description: "You can now access settings with your new PIN." });
      setOtpCode(""); setResetNewPin(""); setResetConfirmPin("");
      setForgotStep("request");
      setActivePanel(null);
      setGateOpen(true);
      setPanelOpen(true);
      refetchPin();
      refetchContext();
    } catch (e: any) {
      toast({ title: e?.message || "Reset failed", variant: "destructive" });
    }
  };

  function closePanel() { setActivePanel(null); }

  // Loading state
  if (!pinData) return (
    <Card>
      <CardContent className="py-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Lock className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <CardTitle>Inventory PIN Security</CardTitle>
            <CardDescription>
              {pinSet
                ? `PIN active — ${protectedPages.length} page${protectedPages.length !== 1 ? "s" : ""} protected · ${unlockDuration} min unlock`
                : "No PIN set — all inventory pages are open"}
            </CardDescription>
          </div>
          {pinSet && (
            <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1 text-xs">
              <ShieldCheck className="h-3 w-3" /> Active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">

        {/* ── Gate: enter PIN to unlock settings ── */}
        {pinSet && !gateOpen && (
          <div className="space-y-3 bg-muted/40 rounded-xl p-4 border">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              Enter current PIN to manage security settings
            </p>
            <PinInput value={gatePin} onChange={setGatePin} label="Current PIN" id="gate-pin" />
            {gateError && <p className="text-xs text-destructive">{gateError}</p>}
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleGateVerify}
                disabled={gateLoading || gatePin.length !== 4}
              >
                {gateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                <span className="ml-2">Unlock Settings</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => { setActivePanel("forgot"); setGateOpen(true); }}
              >
                Forgot PIN?
              </Button>
            </div>
          </div>
        )}

        {/* ── Main panel (visible after gate or when no PIN set) ── */}
        {(canViewPanel) && (
          <div className="space-y-4">

            {/* ── PIN management buttons ── */}
            <div className="grid grid-cols-2 gap-2">
              {!pinSet ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setActivePanel(activePanel === "set" ? null : "set")}
                >
                  <Lock className="mr-2 h-4 w-4" /> Set PIN
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActivePanel(activePanel === "change" ? null : "change")}
                    className="text-xs"
                  >
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Change PIN
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActivePanel(activePanel === "remove" ? null : "remove")}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Remove PIN
                  </Button>
                </>
              )}
            </div>

            {/* ── Set PIN panel ── */}
            {activePanel === "set" && (
              <div className="border rounded-xl p-4 space-y-3 bg-emerald-50/40">
                <p className="text-sm font-semibold text-emerald-800">Set a 4-digit PIN</p>
                <PinInput value={newPin1} onChange={setNewPin1} label="New PIN" id="set-pin1" />
                <PinInput value={newPin2} onChange={setNewPin2} label="Confirm PIN" id="set-pin2" />
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleSetPin}
                    disabled={setPin.isPending}
                  >
                    {setPin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    <span className="ml-2">Set PIN</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={closePanel}>Cancel</Button>
                </div>
              </div>
            )}

            {/* ── Change PIN panel ── */}
            {activePanel === "change" && (
              <div className="border rounded-xl p-4 space-y-3 bg-blue-50/40">
                <p className="text-sm font-semibold text-blue-800">Change PIN</p>
                <PinInput value={chCurrent} onChange={setChCurrent} label="Current PIN" id="ch-current" />
                <PinInput value={chNew} onChange={setChNew} label="New PIN" id="ch-new" />
                <PinInput value={chConfirm} onChange={setChConfirm} label="Confirm New PIN" id="ch-confirm" />
                <div className="flex gap-2 flex-wrap">
                  <Button
                    className="flex-1 min-w-[100px]"
                    onClick={handleChangePin}
                    disabled={changePin.isPending}
                  >
                    {changePin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    <span className="ml-2">Update PIN</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setActivePanel("forgot")}
                  >
                    Forgot current PIN?
                  </Button>
                  <Button variant="ghost" size="sm" onClick={closePanel}>Cancel</Button>
                </div>
              </div>
            )}

            {/* ── Remove PIN panel ── */}
            {activePanel === "remove" && (
              <div className="border border-red-200 rounded-xl p-4 space-y-3 bg-red-50/40">
                <p className="text-sm font-semibold text-red-700">Remove PIN</p>
                <p className="text-xs text-muted-foreground">Enter your current PIN to confirm removal. All PIN protection will be disabled.</p>
                <PinInput value={rmPin} onChange={setRmPin} label="Current PIN" id="rm-pin" />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleRemovePin}
                    disabled={removePin.isPending}
                  >
                    {removePin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                    <span className="ml-2">Remove PIN</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={closePanel}>Cancel</Button>
                </div>
              </div>
            )}

            {/* ── Forgot / Reset PIN panel ── */}
            {activePanel === "forgot" && (
              <div className="border border-amber-200 rounded-xl p-4 space-y-3 bg-amber-50/40">
                <p className="text-sm font-semibold text-amber-800">Reset PIN via Email</p>
                {forgotStep === "request" ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      A 6-digit verification code will be sent to your registered email address.
                    </p>
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={handleForgotRequest}
                      disabled={resetRequest.isPending}
                    >
                      {resetRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      <span className="ml-2">Send Verification Code</span>
                    </Button>
                  </>
                ) : (
                  <>
                    <OtpInput value={otpCode} onChange={setOtpCode} />
                    <PinInput value={resetNewPin} onChange={setResetNewPin} label="New PIN" id="reset-pin1" />
                    <PinInput value={resetConfirmPin} onChange={setResetConfirmPin} label="Confirm New PIN" id="reset-pin2" />
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        className="flex-1 min-w-[100px] bg-amber-600 hover:bg-amber-700"
                        onClick={handleForgotVerify}
                        disabled={resetVerify.isPending}
                      >
                        {resetVerify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-2">Reset PIN</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => { setForgotStep("request"); setOtpCode(""); }}
                      >
                        Resend code
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { closePanel(); setForgotStep("request"); }}>Cancel</Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Forgot PIN link (when panel closed and PIN is set) ── */}
            {pinSet && !activePanel && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                onClick={() => setActivePanel("forgot")}
              >
                <KeyRound className="h-3 w-3" /> Forgot PIN? Reset via email
              </button>
            )}

            {/* ── Unlock Duration ── */}
            {pinSet && (
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                  Auto-lock after
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = opt.value !== 0 && unlockDuration === opt.value && !showCustomDuration;
                    const isCustomSelected = opt.value === 0 && (showCustomDuration || !DURATION_OPTIONS.some(o => o.value === unlockDuration && o.value !== 0));
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleDurationChange(opt.value)}
                        disabled={updateSettings.isPending}
                        className={`text-xs px-2 py-2 rounded-lg border transition-all ${
                          isSelected || isCustomSelected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                            : "border-border text-muted-foreground hover:border-emerald-300 hover:bg-muted/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {showCustomDuration && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={480}
                      placeholder="Minutes (1–480)"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button size="sm" onClick={handleCustomDuration} disabled={updateSettings.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                      Set
                    </Button>
                  </div>
                )}
                {!DURATION_OPTIONS.some(o => o.value === unlockDuration && o.value !== 0) && !showCustomDuration && (
                  <p className="text-xs text-muted-foreground">Custom: {unlockDuration} minutes</p>
                )}
              </div>
            )}

            {/* ── Page toggles ── */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">PIN Protection per Page</Label>
              {!pinSet && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                  Set a PIN first to enable per-page protection.
                </p>
              )}
              <div className="divide-y divide-border rounded-xl border overflow-hidden">
                {PROTECTABLE_PAGES.map((page) => {
                  const on = protectedPages.includes(page.key);
                  return (
                    <div key={page.key} className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium leading-tight">{page.label}</p>
                        <p className="text-[10px] text-muted-foreground">{page.desc}</p>
                      </div>
                      <button
                        onClick={() => pinSet && togglePage(page.key)}
                        disabled={!pinSet || updateSettings.isPending}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all ${
                          on
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        } ${!pinSet ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {on ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        {on ? "ON" : "OFF"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, refetch } = useGetMe();
  const logout = useLogout();

  // Store Name state
  const [snOpen, setSnOpen] = useState(false);
  const [snValue, setSnValue] = useState("");
  const [snLoading, setSnLoading] = useState(false);

  // Change Password state
  const [cpOpen, setCpOpen] = useState(false);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpShowCurrent, setCpShowCurrent] = useState(false);
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);

  // Change Email state
  const [ceOpen, setCeOpen] = useState(false);
  const [ceEmail, setCeEmail] = useState("");
  const [cePassword, setCePassword] = useState("");
  const [ceShowPassword, setCeShowPassword] = useState(false);
  const [ceLoading, setCeLoading] = useState(false);

  // Forgot Password state
  const [fpLoading, setFpLoading] = useState(false);

  // Language state
  const [langLoading, setLangLoading] = useState(false);

  useEffect(() => { document.title = "Settings - LedgerEntries"; }, []);

  const handleUpdateStoreName = async () => {
    if (snValue.trim().length === 0) {
      toast({ title: "Store name cannot be empty", variant: "destructive" }); return;
    }
    if (snValue.trim().length > 60) {
      toast({ title: "Store name must be 60 characters or less", variant: "destructive" }); return;
    }
    setSnLoading(true);
    try {
      const res = await fetch("/api/auth/store-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName: snValue.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Store name updated!", description: `Receipts will now show "${d.storeName}".` });
        setSnOpen(false);
        setSnValue("");
        refetch();
        queryClient.invalidateQueries();
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setSnLoading(false);
    }
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
      onError: (error) => {
        toast({ title: "Error", description: error.error || "Logout failed.", variant: "destructive" });
      },
    });
  };

  const handleChangePassword = async () => {
    if (!cpCurrent || !cpNew || !cpConfirm) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    if (cpNew !== cpConfirm) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    if (cpNew.length < 6) {
      toast({ title: "New password must be at least 6 characters", variant: "destructive" }); return;
    }
    setCpLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Password changed!", description: "Your password has been updated." });
        setCpOpen(false);
        setCpCurrent(""); setCpNew(""); setCpConfirm("");
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setCpLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!ceEmail || !cePassword) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    setCeLoading(true);
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ceEmail, password: cePassword }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Email updated!", description: d.message });
        setCeOpen(false);
        setCeEmail(""); setCePassword("");
        refetch();
        queryClient.invalidateQueries();
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setCeLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = (user as any)?.email;
    if (!email) {
      toast({ title: "No email on file", description: "Add an email first.", variant: "destructive" }); return;
    }
    setFpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Reset email sent!", description: `Check ${email} for the reset link.` });
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setFpLoading(false);
    }
  };

  const handleLanguage = async (code: string) => {
    if (code === (user as any)?.language) return;
    setLangLoading(true);
    try {
      const res = await fetch("/api/auth/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Language updated!", description: LANGUAGES.find(l => l.code === code)?.label });
        refetch();
        queryClient.invalidateQueries();
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setLangLoading(false);
    }
  };

  const currentLang = (user as any)?.language || "en";

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b z-10 px-4 py-3">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-xs text-muted-foreground">Account and app preferences</p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Account</CardTitle>
                <CardDescription>Your account details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-semibold" data-testid="settings-username">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-semibold">{(user as any)?.email || "Not set"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Email Verified</span>
              {(user as any)?.emailVerified ? (
                <Badge className="bg-green-100 text-green-700 border-0 gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </Badge>
              ) : (user as any)?.email ? (
                <Badge className="bg-amber-100 text-amber-700 border-0 gap-1 text-xs">
                  <XCircle className="h-3 w-3" /> Not Verified
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">No email set</span>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge className={(user as any)?.role === "admin" ? "bg-amber-100 text-amber-700 border-0 gap-1" : "bg-muted text-muted-foreground border-0"}>
                {(user as any)?.role === "admin" ? <><Crown className="h-3 w-3" /> Admin</> : "User"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Member Since</span>
              <span className="text-sm font-semibold">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Store Name */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-violet-50 rounded-xl flex items-center justify-center">
                <Pencil className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Store Name</CardTitle>
                <CardDescription>
                  Shown on receipts — currently:{" "}
                  <strong className="text-foreground">
                    {(user as any)?.storeName || user?.username || "Not set"}
                  </strong>
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSnOpen(!snOpen);
                  setSnValue((user as any)?.storeName || "");
                }}
                className="text-xs"
              >
                {snOpen ? "Cancel" : "Change"}
              </Button>
            </div>
          </CardHeader>
          {snOpen && (
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <Label htmlFor="sn-value" className="text-xs">New Store Name</Label>
                <Input
                  id="sn-value"
                  type="text"
                  placeholder="e.g. SIAB Mobile Doctor"
                  value={snValue}
                  onChange={(e) => setSnValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateStoreName()}
                  autoComplete="off"
                  maxLength={60}
                />
                <p className="text-[10px] text-muted-foreground">
                  Max 60 characters. Spaces allowed. This is separate from your login username.
                </p>
              </div>
              <p className="text-[11px] text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                This name will appear on all Fund Transfer / Receive receipts as the store heading.
              </p>
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={handleUpdateStoreName}
                disabled={snLoading}
              >
                {snLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Pencil className="mr-2 h-4 w-4" />
                Save Store Name
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Change Email */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Email Address</CardTitle>
                <CardDescription>Update your email address</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCeOpen(!ceOpen); }}
                className="text-xs"
              >
                {ceOpen ? "Cancel" : "Change"}
              </Button>
            </div>
          </CardHeader>
          {ceOpen && (
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <Label htmlFor="ce-email" className="text-xs">New Email Address</Label>
                <Input
                  id="ce-email"
                  type="email"
                  placeholder="new@email.com"
                  value={ceEmail}
                  onChange={(e) => setCeEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-password" className="text-xs">Current Password (to confirm)</Label>
                <div className="relative">
                  <Input
                    id="ce-password"
                    type={ceShowPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={cePassword}
                    onChange={(e) => setCePassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10"
                    onClick={() => setCeShowPassword(!ceShowPassword)}
                  >
                    {ceShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                A verification link will be sent to your new email.
                You'll need to verify it before accessing the app.
              </p>
              <Button
                className="w-full"
                onClick={handleChangeEmail}
                disabled={ceLoading}
              >
                {ceLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Email & Send Verification
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Security / Change Password */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Security</CardTitle>
                <CardDescription>Password and account security</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCpOpen(!cpOpen)}
                className="text-xs"
              >
                {cpOpen ? "Cancel" : "Change Password"}
              </Button>
            </div>
          </CardHeader>
          {cpOpen && (
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <Label htmlFor="cp-current" className="text-xs">Current Password</Label>
                <div className="relative">
                  <Input
                    id="cp-current"
                    type={cpShowCurrent ? "text" : "password"}
                    placeholder="Your current password"
                    value={cpCurrent}
                    onChange={(e) => setCpCurrent(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10"
                    onClick={() => setCpShowCurrent(!cpShowCurrent)}
                  >
                    {cpShowCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-new" className="text-xs">New Password</Label>
                <div className="relative">
                  <Input
                    id="cp-new"
                    type={cpShowNew ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={cpNew}
                    onChange={(e) => setCpNew(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10"
                    onClick={() => setCpShowNew(!cpShowNew)}
                  >
                    {cpShowNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-confirm" className="text-xs">Confirm New Password</Label>
                <Input
                  id="cp-confirm"
                  type="password"
                  placeholder="Repeat new password"
                  value={cpConfirm}
                  onChange={(e) => setCpConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                />
              </div>
              <Button className="w-full" onClick={handleChangePassword} disabled={cpLoading}>
                {cpLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Lock className="mr-2 h-4 w-4" />
                Update Password
              </Button>
            </CardContent>
          )}
          {!cpOpen && (
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Forgot your password?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary h-7 px-2"
                  onClick={handleForgotPassword}
                  disabled={fpLoading}
                >
                  {fpLoading
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <><KeyRound className="mr-1 h-3 w-3" /> Send Reset Email</>}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Inventory PIN Security */}
        <PinSecurityCard />

        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Language</CardTitle>
                <CardDescription>Choose your display language</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  disabled={langLoading}
                  onClick={() => handleLanguage(lang.code)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                    currentLang === lang.code
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className={`text-xs font-medium ${currentLang === lang.code ? "text-primary" : "text-muted-foreground"}`}>
                    {lang.label}
                  </span>
                  {currentLang === lang.code && (
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>Need help? Reach out to us</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <a href="mailto:Ledger.Entries@gmail.com" className="flex items-center justify-between py-2 group">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-semibold text-primary group-hover:underline">
                Ledger.Entries@gmail.com
              </span>
            </a>
            <p className="text-xs text-muted-foreground mt-2">We typically respond within 24 hours.</p>
          </CardContent>
        </Card>

        {/* Admin Dashboard */}
        {(user as any)?.role === "admin" && (
          <Button
            variant="outline"
            className="w-full h-12 text-base border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => setLocation("/admin")}
            data-testid="button-admin-dashboard"
          >
            <ShieldCheck className="mr-2 h-5 w-5" />
            Admin Dashboard
          </Button>
        )}

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full h-12 text-base"
          onClick={handleLogout}
          disabled={logout.isPending}
          data-testid="button-logout-settings"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </Button>

        {/* About / Credit */}
        <div className="text-center py-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">LedgerEntries — ledgerentries.com</p>
          <p className="text-xs text-muted-foreground">
            Designed by <span className="font-semibold text-foreground">Mobile Doctor Developers</span>
          </p>
          <p className="text-[10px] text-muted-foreground/60">© {new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
