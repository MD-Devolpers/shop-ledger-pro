import { Link, useLocation } from "wouter";
import { 
  Home, 
  ListOrdered, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Settings,
  DatabaseBackup,
  Menu,
  LogOut,
  BookOpen,
} from "lucide-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { icon: Home, label: "Home", href: "/app" },
  { icon: ListOrdered, label: "Entries", href: "/entries" },
  { icon: Users, label: "Credits", href: "/credits" },
  { icon: TrendingUp, label: "Profits", href: "/profits" },
  { icon: BarChart3, label: "Reports", href: "/reports" },
];

const secondaryNavItems = [
  { icon: DatabaseBackup, label: "Backup", href: "/backup" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const { toast } = useToast();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/"),
      onError: (error) => {
        toast({
          title: "Logout failed",
          description: error.error || "An unexpected error occurred",
          variant: "destructive",
        });
      }
    });
  };

  const isActive = (href: string) =>
    location === href || (href.length > 4 && location.startsWith(href));

  const NavLinks = ({ items, onClick }: { items: typeof navItems; onClick?: () => void }) => (
    <div className="flex flex-col space-y-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={active ? "secondary" : "ghost"}
              className={`w-full justify-start ${active ? "font-semibold" : "font-normal text-muted-foreground"}`}
              onClick={onClick}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className={`mr-3 h-5 w-5 ${active ? "text-primary" : ""}`} />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );

  const LogoMark = () => (
    <div className="flex items-center gap-2">
      <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center shadow-sm">
        <BookOpen className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="font-bold text-base tracking-tight">LedgerEntries</span>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <LogoMark />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b text-left">
              <SheetTitle>
                <LogoMark />
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-6">
              <NavLinks items={navItems} />
              <div className="h-px bg-border my-2" />
              <NavLinks items={secondaryNavItems} />
            </div>
            {user && (
              <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium truncate">{user.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {(user as any)?.role === "admin" ? "Admin" : "Shop Owner"}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">LedgerEntries</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-4 flex flex-col gap-6">
          <NavLinks items={navItems} />
          <div className="h-px bg-border my-2" />
          <NavLinks items={secondaryNavItems} />
        </div>
        {user && (
          <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-10 w-10 border border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{user.username}</span>
                <span className="text-xs text-muted-foreground">
                  {(user as any)?.role === "admin" ? "Admin" : "Shop Owner"}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout-desktop">
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background md:bg-muted/10">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden sticky bottom-0 z-10 border-t bg-card flex items-center justify-around p-2 pb-safe">
        {navItems.slice(0, 4).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex flex-col items-center justify-center p-2 min-w-[64px] ${active ? "text-primary" : "text-muted-foreground"}`}
                data-testid={`bottom-nav-${item.label.toLowerCase()}`}
              >
                <div className={`mb-1 p-1 rounded-full ${active ? "bg-primary/10" : ""}`}>
                  <item.icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
