import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSignup, useGetMe } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username is too long"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { retry: false } });
  const signupMutation = useSignup();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    document.title = "Sign Up - Daily Shop Ledger";
    if (user) {
      setLocation("/");
    }
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
      { 
        data: {
          username: data.username,
          password: data.password,
          email: data.email || undefined,
        } 
      },
      {
        onSuccess: () => {
          toast({
            title: "Account created!",
            description: "Welcome to Daily Shop Ledger.",
          });
          setLocation("/");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm mb-4">
            <span className="text-2xl font-bold text-primary-foreground">L</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create an Account</h1>
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
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="owner@shop.com" {...field} data-testid="input-signup-email" />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">Used for password resets</p>
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
                  className="w-full mt-6" 
                  disabled={signupMutation.isPending}
                  data-testid="button-submit-signup"
                >
                  {signupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
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
