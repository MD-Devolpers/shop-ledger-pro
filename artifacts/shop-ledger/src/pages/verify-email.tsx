import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { CheckCircle2, XCircle, Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    document.title = "Verify Email - LedgerEntries";
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token found in the URL.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus(data.alreadyVerified ? "already" : "success");
        } else {
          setStatus("error");
          setErrorMsg(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Network error. Please try again.");
      });
  }, []);

  const resendVerification = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: data.emailSent ? "Verification email sent!" : "Email not configured",
          description: data.emailSent
            ? "Please check your inbox."
            : "Contact support to verify your email.",
        });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm mb-4">
            <span className="text-2xl font-bold text-primary-foreground">L</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Email Verification</h1>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            {status === "loading" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <CardTitle className="text-lg">Verifying your email...</CardTitle>
              </div>
            )}
            {status === "success" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <CardTitle className="text-lg text-green-700">Email Verified!</CardTitle>
              </div>
            )}
            {status === "already" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="rounded-full bg-blue-100 p-3">
                  <CheckCircle2 className="h-10 w-10 text-blue-600" />
                </div>
                <CardTitle className="text-lg text-blue-700">Already Verified</CardTitle>
              </div>
            )}
            {status === "error" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="rounded-full bg-red-100 p-3">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <CardTitle className="text-lg text-red-700">Verification Failed</CardTitle>
              </div>
            )}
          </CardHeader>

          <CardContent className="text-center space-y-4 pb-6">
            {status === "loading" && (
              <p className="text-muted-foreground text-sm">Please wait while we verify your email address...</p>
            )}
            {status === "success" && (
              <>
                <p className="text-muted-foreground text-sm">
                  Your email has been verified successfully. You can now use all features of LedgerEntries.
                </p>
                <Button className="w-full" onClick={() => setLocation("/")}>
                  Go to Dashboard
                </Button>
              </>
            )}
            {status === "already" && (
              <>
                <p className="text-muted-foreground text-sm">Your email was already verified. You're all set!</p>
                <Button className="w-full" onClick={() => setLocation("/")}>
                  Go to Dashboard
                </Button>
              </>
            )}
            {status === "error" && (
              <>
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={resendVerification}
                  disabled={resending}
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Resend Verification Email
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full text-sm">
                    Back to Login
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
