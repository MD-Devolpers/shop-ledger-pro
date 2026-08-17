import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Reset Password - LedgerEntries";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast({ title: "Required", description: "Please enter your username or email.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          identifier.includes("@")
            ? { email: identifier.trim() }
            : { username: identifier.trim() }
        ),
      });
      const d = await res.json();
      if (res.ok) {
        setSent(true);
        toast({ title: "Reset email sent!", description: "Check your inbox for the reset link." });
      } else {
        toast({ title: "Error", description: d.error || "Could not send reset email.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm mb-4">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-muted-foreground mt-1">Enter your username or email to reset</p>
        </div>

        <Card className="border-0 shadow-xl sm:border">
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <CardDescription>
              {sent ? "Reset email sent!" : "We'll send a reset link to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4 space-y-4">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-sm text-green-700 font-medium">Reset link sent!</p>
                  <p className="text-xs text-green-600 mt-1">
                    Check your email inbox for the password reset link. It expires in 1 hour.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Didn't receive it? Check your spam folder or try again.
                </p>
                <div className="flex flex-col gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSent(false)} className="w-full">
                    Try again
                  </Button>
                  <Link href="/login">
                    <Button variant="outline" className="w-full" data-testid="button-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Username or Email Address</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="yourname or you@email.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    data-testid="input-forgot-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the username or email you used when signing up.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  data-testid="button-send-reset"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
