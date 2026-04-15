import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Settings as SettingsIcon, Globe, LogOut, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const logout = useLogout();

  useEffect(() => { document.title = "Settings - Daily Shop Ledger"; }, []);

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
            <div className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-semibold" data-testid="settings-username">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-semibold">{user?.email || "Not set"}</span>
            </div>
            <div className="flex items-center justify-between py-2 last:border-0">
              <span className="text-sm text-muted-foreground">Member Since</span>
              <span className="text-sm font-semibold">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </CardContent>
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
                <CardDescription>Display language for the app</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Language</span>
              <Badge variant="secondary" className="font-semibold">English</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-3">More languages coming soon.</p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Account security settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your data is secured with encrypted sessions. To change your password, use the forgot password feature on the login page.
            </p>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}
