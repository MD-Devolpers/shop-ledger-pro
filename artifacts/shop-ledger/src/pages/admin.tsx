import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Users,
  ShieldCheck,
  Loader2,
  Trash2,
  Crown,
  User,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileText,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useGetMe } from "@workspace/api-client-react";

function formatDate(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}

type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
  language: string;
  createdAt: string;
  entryCount: number;
  creditCount: number;
};

type PlatformStats = {
  totalUsers: number;
  totalEntries: number;
  totalCredits: number;
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me, isLoading: meLoading } = useGetMe({ query: { retry: false } });

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    document.title = "Admin Dashboard - Daily Shop Ledger";
  }, []);

  useEffect(() => {
    if (!meLoading && me) {
      if ((me as any).role !== "admin") {
        setLocation("/");
        return;
      }
      loadData();
    } else if (!meLoading && !me) {
      setLocation("/login");
    }
  }, [me, meLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
        toast({ title: `${user.username} is now ${newRole}` });
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete "${user.username}"? This cannot be undone.`)) return;
    setActionLoading(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        toast({ title: `${user.username} deleted` });
      } else {
        const d = await res.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (meLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">Manage users and platform data</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Platform Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </Card>
            <Card className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.totalEntries}</p>
              <p className="text-xs text-muted-foreground">Total Entries</p>
            </Card>
            <Card className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.totalCredits}</p>
              <p className="text-xs text-muted-foreground">Total Credits</p>
            </Card>
          </div>
        )}

        {/* Users Table */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users ({users.length})
          </h2>
          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      user.role === "admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {user.username[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{user.username}</p>
                      {user.role === "admin" && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0 gap-0.5">
                          <Crown className="h-2.5 w-2.5" />
                          Admin
                        </Badge>
                      )}
                      <Badge
                        className={`text-[10px] px-1.5 py-0 h-4 border-0 gap-0.5 ${
                          user.emailVerified
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.emailVerified ? (
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        ) : (
                          <XCircle className="h-2.5 w-2.5" />
                        )}
                        {user.emailVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user.email || "No email"} · Joined {formatDate(user.createdAt)}
                    </p>
                    <div className="flex gap-3 mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{user.entryCount}</span> entries
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{user.creditCount}</span> credits
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {actionLoading === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {user.id !== (me as any)?.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${
                                user.role === "admin"
                                  ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              onClick={() => toggleRole(user)}
                              title={user.role === "admin" ? "Remove admin" : "Make admin"}
                            >
                              <Crown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteUser(user)}
                              title="Delete user"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {user.id === (me as any)?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No users found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
