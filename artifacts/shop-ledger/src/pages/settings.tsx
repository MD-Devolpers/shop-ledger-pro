import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  Globe, LogOut, User, Shield, ShieldCheck, CheckCircle2,
  XCircle, Crown, Mail, Lock, KeyRound, Loader2, Eye, EyeOff, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "hi", label: "हिंदी", flag: "🇮🇳" },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, refetch } = useGetMe();
  const logout = useLogout();

  // Change Username state
  const [cuOpen, setCuOpen] = useState(false);
  const [cuUsername, setCuUsername] = useState("");
  const [cuPassword, setCuPassword] = useState("");
  const [cuShowPassword, setCuShowPassword] = useState(false);
  const [cuLoading, setCuLoading] = useState(false);

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

  const handleChangeUsername = async () => {
    if (!cuUsername || !cuPassword) {
      toast({ title: "All fields required", variant: "destructive" }); return;
    }
    if (cuUsername.trim().length < 3) {
      toast({ title: "Username must be at least 3 characters", variant: "destructive" }); return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cuUsername.trim())) {
      toast({ title: "Only letters, numbers, and underscores allowed", variant: "destructive" }); return;
    }
    setCuLoading(true);
    try {
      const res = await fetch("/api/auth/change-username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: cuUsername.trim(), password: cuPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Username updated!", description: `Your username is now "${d.username}".` });
        setCuOpen(false);
        setCuUsername(""); setCuPassword("");
        refetch();
        queryClient.invalidateQueries();
      } else {
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setCuLoading(false);
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

        {/* Change Username */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-violet-50 rounded-xl flex items-center justify-center">
                <Pencil className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <CardTitle>Store Name / Username</CardTitle>
                <CardDescription>Change your username (used on receipts)</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCuOpen(!cuOpen); setCuUsername(""); setCuPassword(""); }}
                className="text-xs"
              >
                {cuOpen ? "Cancel" : "Change"}
              </Button>
            </div>
          </CardHeader>
          {cuOpen && (
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <Label htmlFor="cu-username" className="text-xs">New Username</Label>
                <Input
                  id="cu-username"
                  type="text"
                  placeholder="e.g. MobileDoctor"
                  value={cuUsername}
                  onChange={(e) => setCuUsername(e.target.value)}
                  autoComplete="off"
                />
                <p className="text-[10px] text-muted-foreground">
                  3–30 characters. Letters, numbers, and underscores only. (Current: <strong>{user?.username}</strong>)
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-password" className="text-xs">Current Password (to confirm)</Label>
                <div className="relative">
                  <Input
                    id="cu-password"
                    type={cuShowPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={cuPassword}
                    onChange={(e) => setCuPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChangeUsername()}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10"
                    onClick={() => setCuShowPassword(!cuShowPassword)}
                  >
                    {cuShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                Your new username will appear on all fund transfer receipts as the store name.
              </p>
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={handleChangeUsername}
                disabled={cuLoading}
              >
                {cuLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Pencil className="mr-2 h-4 w-4" />
                Update Username
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
