import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSignup, useGetMe } from "@workspace/api-client-react";
import { Loader2, Mail, CheckCircle2, BookOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username is too long"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });
  const signupMutation = useSignup();
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    document.title = "Sign Up - LedgerEntries";
    if (user) setLocation("/app");
  }, [user, setLocation]);

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const onSubmit = (data: z.infer<typeof signupSchema>) => {
    signupMutation.mutate(
      { data: { username: data.username, password: data.password, email: data.email } },
      {
        onSuccess: () => {
          // Always show "check your email" screen — email is compulsory
          setEmailSentTo(data.email);
        },
        onError: (error) => {
          toast({
            title: "Signup failed",
            description: error.error || "An error occurred while creating your account.",
            variant: "destructive",
          });
        },
      }
    );
  };

  // ── Email sent confirmation screen ──────────────────────────────────────
  if (emailSentTo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-5">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-3">
              <BookOpen className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">LedgerEntries</h1>
          </div>

          <Card className="border-0 shadow-xl text-center p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-green-100 p-4">
                <Mail className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Check Your Email</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  We sent a verification link to:
                </p>
                <p className="font-semibold text-primary mt-1 break-all">{emailSentTo}</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-800 text-left w-full space-y-1">
                <p className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Account created!
                </p>
                <p>Email verify karo taakay dashboard access ho sake.</p>
                <p>Spam/Junk folder bhi zaroor dekhen.</p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const res = await fetch("/api/auth/resend-verification", { method: "POST" });
                  if (res.ok) alert("Verification email resent! Please check your inbox.");
                  else alert("Please try again in a moment.");
                }}
              >
                Resend Email
              </Button>
              <Link href="/login">
                <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer underline">
                  Already verified? Sign in
                </span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── Signup form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-3">
            <BookOpen className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LedgerEntries</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your account to get started</p>
        </div>

        <Card className="border-0 shadow-xl bg-card/50 backdrop-blur-sm sm:border sm:bg-card">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Get started with your digital ledger today</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="shopowner" {...field} data-testid="input-signup-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        Email
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">Required</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="owner@example.com" {...field} data-testid="input-signup-email" />
                      </FormControl>
                      <div className="flex items-center gap-1 mt-1">
                        <ShieldCheck className="h-3 w-3 text-primary flex-shrink-0" />
                        <p className="text-xs text-muted-foreground">Required for account verification and password recovery</p>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="input-signup-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} data-testid="input-signup-confirm-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full mt-6 gap-2"
                  disabled={signupMutation.isPending}
                  data-testid="button-submit-signup"
                >
                  {signupMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Mail className="h-4 w-4" />}
                  Create Account & Send Verification
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <Button variant="link" className="px-1 text-primary font-medium" data-testid="link-to-login">
                  Sign in
                </Button>
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
