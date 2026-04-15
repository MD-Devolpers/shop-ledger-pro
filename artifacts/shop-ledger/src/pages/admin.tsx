import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Users,
  ShieldCheck,
  Loader2,
  Trash2,
  Crown,
  CheckCircle2,
  XCircle,
  TrendingUp,
  FileText,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useGetMe } from "@workspace/api-client-react";

function formatDate(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(n);
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
  deletedEntries: number;
};

type DeletedEntry = {
  id: number;
  userId: number;
  username: string | null;
  type: string;
  amount: number;
  description: string | null;
  paymentMethod: string;
  isCredit: boolean;
  customerName: string | null;
  deletedAt: string;
  entryDate: string | null;
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: me, isLoading: meLoading } = useGetMe({ query: { retry: false } });

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [deletedEntries, setDeletedEntries] = useState<DeletedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    document.title = "Admin Panel - LedgerEntries";
  }, []);

  useEffect(() => {
    if (!meLoading && me) {
      if ((me as any).role !== "admin") {
        setLocation("/app");
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
      const [usersRes, statsRes, deletedRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/deleted-entries"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (deletedRes.ok) setDeletedEntries(await deletedRes.json());
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
    if (!confirm(`Delete "${user.username}"? This cannot be undone and will delete all their data.`)) return;
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

  const permanentDeleteEntry = async (id: number) => {
    if (!confirm("Permanently delete this entry? Cannot be undone.")) return;
    const res = await fetch(`/api/admin/entries/${id}/permanent`, { method: "DELETE" });
    if (res.ok) {
      setDeletedEntries((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Entry permanently deleted" });
    }
  };

  const purgeAll = async () => {
    if (!confirm(`Permanently delete ALL ${deletedEntries.length} deleted entries? This CANNOT be undone.`)) return;
    setPurging(true);
    try {
      const res = await fetch("/api/admin/entries/purge-deleted", { method: "DELETE" });
      if (res.ok) {
        const d = await res.json();
        setDeletedEntries([]);
        toast({ title: `Purged ${d.count} entries` });
        loadData();
      }
    } finally {
      setPurging(false);
    }
  };

  if (meLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/app")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Admin Panel
              </h1>
              <p className="text-xs text-muted-foreground">LedgerEntries</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-5">
        {/* Platform Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Users", value: stats.totalUsers, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Entries", value: stats.totalEntries, color: "text-green-600", bg: "bg-green-50" },
              { label: "Credits", value: stats.totalCredits, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Deleted", value: stats.deletedEntries, color: "text-red-600", bg: "bg-red-50" },
            ].map((s) => (
              <Card key={s.label} className={`p-4 text-center border-0 ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" /> Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="deleted" className="gap-1.5 data-[state=active]:text-red-600">
              <Trash2 className="h-4 w-4" /> Deleted Records ({deletedEntries.length})
            </TabsTrigger>
          </TabsList>

          {/* ── Users Tab ── */}
          <TabsContent value="users" className="space-y-2 mt-3">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    user.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {user.username[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{user.username}</p>
                      {user.role === "admin" && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0 gap-0.5">
                          <Crown className="h-2.5 w-2.5" /> Admin
                        </Badge>
                      )}
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 gap-0.5 ${
                        user.emailVerified ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {user.emailVerified ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                        {user.emailVerified ? "Verified" : "Unverified"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user.email || "No email"} · Joined {formatDate(user.createdAt)}
                    </p>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{user.entryCount}</strong> entries
                      </span>
                      <span className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{user.creditCount}</strong> credits
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {actionLoading === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : user.id === (me as any)?.id ? (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${user.role === "admin" ? "text-amber-600 hover:bg-amber-50" : "text-muted-foreground"}`}
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
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* ── Deleted Records Tab ── */}
          <TabsContent value="deleted" className="mt-3 space-y-3">
            {deletedEntries.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>These entries are soft-deleted. Permanently delete to free up storage.</span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={purgeAll}
                  disabled={purging}
                  className="ml-2 flex-shrink-0"
                >
                  {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Purge All
                </Button>
              </div>
            )}

            {deletedEntries.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No deleted records</p>
                <p className="text-xs mt-1">Recycle bin is empty across all users</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deletedEntries.map((entry) => (
                  <Card key={entry.id} className="p-3 border-red-100 bg-red-50/30">
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        entry.type === "cash_in" ? "bg-green-100" : "bg-red-100"
                      }`}>
                        <TrendingUp className={`h-4 w-4 ${entry.type === "cash_in" ? "text-green-600" : "text-red-600 rotate-180"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{formatAmount(entry.amount)}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {entry.paymentMethod}
                          </Badge>
                          {entry.isCredit && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0">
                              Credit
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.description || "No description"} · User: <strong>{entry.username || `#${entry.userId}`}</strong>
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">
                          Deleted: {formatDate(entry.deletedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={() => permanentDeleteEntry(entry.id)}
                        title="Permanently delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
