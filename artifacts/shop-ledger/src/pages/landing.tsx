import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  BookOpen,
  TrendingUp,
  Users,
  BarChart3,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Banknote,
  CreditCard,
  RefreshCcw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Banknote,
    color: "bg-green-100 text-green-600",
    title: "Cash & Digital Tracking",
    desc: "Log every cash and digital payment instantly. See your daily balance at a glance.",
  },
  {
    icon: Users,
    color: "bg-blue-100 text-blue-600",
    title: "Credit Management",
    desc: "Track who owes you and who you owe. Receive partial or full payments with one tap.",
  },
  {
    icon: TrendingUp,
    color: "bg-amber-100 text-amber-600",
    title: "Profit Per Entry",
    desc: "Add profit margin to each sale. See your total daily, weekly and monthly profit.",
  },
  {
    icon: BarChart3,
    color: "bg-purple-100 text-purple-600",
    title: "Reports & Analytics",
    desc: "Daily, weekly, and monthly reports. Know exactly how your business is performing.",
  },
  {
    icon: RefreshCcw,
    color: "bg-red-100 text-red-600",
    title: "Recycle Bin",
    desc: "Accidentally deleted something? Restore it from the recycle bin any time.",
  },
  {
    icon: ShieldCheck,
    color: "bg-emerald-100 text-emerald-600",
    title: "Secure & Private",
    desc: "Your data is stored securely on the server. Backed up and protected with email verification.",
  },
];

const steps = [
  { num: "1", title: "Create Account", desc: "Sign up with your email in under a minute" },
  { num: "2", title: "Add Entries", desc: "Log cash in, cash out, credits, and profit" },
  { num: "3", title: "View Reports", desc: "See daily/weekly/monthly summaries instantly" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    document.title = "LedgerEntries - Smart Daily Shop Accounting";
    if (!isLoading && user) {
      setLocation("/app");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">LedgerEntries</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="hidden sm:flex">Get Started Free</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="sm:hidden">Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background px-4 pt-16 pb-20 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-semibold mb-6">
            <Star className="h-3.5 w-3.5" />
            Free for small shops — ledgerentries.com
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-5">
            Smart Daily
            <span className="text-primary block sm:inline"> Shop Accounting</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Track cash, digital payments, credits, and profit — all in one simple app.
            Built for small shop owners. Works on mobile and web.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12 px-8 shadow-lg">
                Start Free Today
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-12 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative UI preview card */}
        <div className="mt-14 max-w-sm mx-auto">
          <div className="bg-card border rounded-2xl shadow-2xl p-5 text-left">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-muted-foreground">Today's Summary</p>
              <span className="text-xs text-muted-foreground">Apr 15</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 font-medium">Cash In</p>
                <p className="text-base font-bold text-green-700">₨ 12,500</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600 font-medium">Cash Out</p>
                <p className="text-base font-bold text-red-700">₨ 4,200</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-600 font-medium">Profit</p>
                <p className="text-base font-bold text-amber-700">₨ 2,800</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: "Milk Sales", amount: "+₨ 3,500", color: "text-green-600" },
                { label: "Stock Purchase", amount: "-₨ 2,100", color: "text-red-600" },
                { label: "Ahmed Bhai (Credit)", amount: "₨ 800", color: "text-amber-600" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className={`text-xs font-semibold ${row.color}`}>{row.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Everything Your Shop Needs</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              All the accounting tools you need, designed to be simple and fast.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="bg-card border rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className={`h-10 w-10 rounded-xl ${f.color} flex items-center justify-center mb-3`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Get Started in Minutes</h2>
          <p className="text-muted-foreground mb-10">No training needed. Just sign up and start tracking.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative flex flex-col items-center text-center">
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-6 left-1/2 w-full border-t-2 border-dashed border-primary/20" />
                )}
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center shadow-md mb-3 relative z-10">
                  {step.num}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why section ── */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card border rounded-2xl p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-5 text-center">Why LedgerEntries?</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "100% Free — no hidden charges",
                "Works on mobile, tablet, and desktop",
                "Secure email-verified accounts",
                "Soft delete — nothing lost forever",
                "Offline-friendly progressive web app",
                "Daily, weekly & monthly reports",
                "Credit tracking with payment history",
                "Export and backup your data anytime",
              ].map((point) => (
                <div key={point} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-4 text-center">
        <div className="max-w-md mx-auto">
          <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <BookOpen className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Start Tracking Today</h2>
          <p className="text-muted-foreground mb-7">
            Join shop owners who trust LedgerEntries for their daily hisaab.
          </p>
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12 px-10 shadow-lg">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login">
              <span className="text-primary font-medium cursor-pointer hover:underline">Sign in</span>
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t bg-muted/30 px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-primary rounded-md flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">LedgerEntries</span>
            <span>— ledgerentries.com</span>
          </div>
          <div className="flex gap-5">
            <Link href="/login"><span className="hover:text-foreground cursor-pointer">Login</span></Link>
            <Link href="/signup"><span className="hover:text-foreground cursor-pointer">Sign Up</span></Link>
          </div>
          <div className="text-center sm:text-right">
            <p>© {new Date().getFullYear()} LedgerEntries. All rights reserved.</p>
            <p className="text-xs mt-0.5">Designed by <span className="font-medium text-foreground">Mobile Doctor Developers</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
