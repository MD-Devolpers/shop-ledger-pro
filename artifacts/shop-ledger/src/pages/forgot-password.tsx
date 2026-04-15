import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export default function ForgotPassword() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const mutation = useForgotPassword();

  useEffect(() => {
    document.title = "Reset Password - Daily Shop Ledger";
  }, []);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    mutation.mutate(
      { data },
      {
        onSuccess: () => {
          setSent(true);
          toast({ title: "Email sent", description: "Check your email for reset instructions." });
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.error || "Could not send reset email.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm mb-4">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-muted-foreground mt-1">Enter your email to reset your password</p>
        </div>

        <Card className="border-0 shadow-xl sm:border">
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <CardDescription>
              {sent ? "Reset email sent!" : "We'll send you a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  If an account exists with that email, you'll receive a password reset link shortly.
                </p>
                <Link href="/login">
                  <Button variant="outline" data-testid="button-back-to-login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="owner@shop.com" {...field} data-testid="input-forgot-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-send-reset">
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full" data-testid="link-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Login
                    </Button>
                  </Link>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
