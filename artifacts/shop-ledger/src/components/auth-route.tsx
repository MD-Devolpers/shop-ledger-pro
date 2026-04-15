import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Loader2, Mail, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError, refetch } = useGetMe({ query: { retry: false } });
  const logout = useLogout();

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      setLocation("/login");
    }
  }, [isLoading, isError, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !user) return null;

  // Email verification gate — block access if user has email but it's not verified
  const hasEmail = !!(user as any).email;
  const isVerified = !!(user as any).emailVerified;

  if (hasEmail && !isVerified) {
    const handleResend = async () => {
      await fetch("/api/auth/resend-verification", { method: "POST" });
      alert("Verification email resent! Please check your inbox.");
    };

    const handleLogout = () => {
      logout.mutate(undefined, {
        onSuccess: () => {
          queryClient.clear();
          setLocation("/login");
        },
      });
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-3">
              <span className="text-2xl font-bold text-primary-foreground">L</span>
            </div>
            <h1 className="text-2xl font-bold">LedgerEntries</h1>
          </div>

          <div className="bg-card border rounded-2xl shadow-xl p-6 text-center space-y-4">
            <div className="rounded-full bg-amber-100 p-3 w-fit mx-auto">
              <Mail className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Verify Your Email</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We sent a verification link to:
              </p>
              <p className="font-semibold text-primary mt-1 text-sm break-all">
                {(user as any).email}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 text-left">
              Email verify karna zaruri hai app use karne ke liye. Inbox check karein, Spam folder bhi dekhen.
            </div>

            <Button className="w-full gap-2" onClick={handleResend}>
              <RefreshCw className="h-4 w-4" />
              Resend Verification Email
            </Button>

            <button
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
