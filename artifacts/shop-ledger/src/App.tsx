import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { OfflineProvider } from "@/contexts/offline-context";
import { AuthRoute } from "@/components/auth-route";
import { PinProvider } from "@/contexts/pin-context";
import PinGuard from "@/components/pin-guard";

const Landing = lazy(() => import("@/pages/landing"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/login"));
const Signup = lazy(() => import("@/pages/signup"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const VerifyEmail = lazy(() => import("@/pages/verify-email"));
const Admin = lazy(() => import("@/pages/admin"));
const Home = lazy(() => import("@/pages/home"));
const Entries = lazy(() => import("@/pages/entries"));
const EntriesReport = lazy(() => import("@/pages/entries-report"));
const Credits = lazy(() => import("@/pages/credits"));
const Profits = lazy(() => import("@/pages/profits"));
const Reports = lazy(() => import("@/pages/reports"));
const Backup = lazy(() => import("@/pages/backup"));
const Settings = lazy(() => import("@/pages/settings"));
const RecycleBin = lazy(() => import("@/pages/recycle-bin"));
const Closing = lazy(() => import("@/pages/closing"));
const DigitalReport = lazy(() => import("@/pages/digital-report"));
const Inventory = lazy(() => import("@/pages/inventory/index"));
const Products = lazy(() => import("@/pages/inventory/products"));
const PurchaseBills = lazy(() => import("@/pages/inventory/purchase-bills"));
const ProductSale = lazy(() => import("@/pages/inventory/product-sale"));
const ProductReturn = lazy(() => import("@/pages/inventory/product-return"));
const ProductReports = lazy(() => import("@/pages/inventory/product-reports"));
const BillSettings = lazy(() => import("@/pages/inventory/bill-settings"));
const Masters = lazy(() => import("@/pages/inventory/masters"));
const CompanyReplacements = lazy(() => import("@/pages/inventory/company-replacements"));
const SupplierBalance = lazy(() => import("@/pages/inventory/supplier-balance"));
const ProductHistory = lazy(() => import("@/pages/inventory/product-history"));
const BulkPurchase = lazy(() => import("@/pages/inventory/bulk-purchase"));
const BulkReplacement = lazy(() => import("@/pages/inventory/bulk-replacement"));
const WarrantyCheck = lazy(() => import("@/pages/inventory/warranty-check"));
const QuickProducts = lazy(() => import("@/pages/inventory/quick-products"));
const MobilePurchase = lazy(() => import("@/pages/inventory/mobile-purchase"));
const BulkMobilePurchase = lazy(() => import("@/pages/inventory/bulk-mobile-purchase"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  if (!fullScreen) {
    return (
      <div className="min-h-[420px] bg-muted/20 p-4 md:p-6" role="status" aria-label="Loading page">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-lg bg-muted" />
            <div className="h-4 w-72 max-w-full rounded bg-muted/80" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-xl border bg-card shadow-sm" />
            ))}
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-5 h-10 w-full rounded-lg bg-muted/80" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-12 w-full rounded-lg bg-muted/60" />
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-teal-50">
      <div className="rounded-2xl border bg-card/95 px-10 py-8 shadow-sm flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-9 w-9 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm font-semibold text-foreground">Loading LedgerEntries...</p>
      </div>
    </div>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthRoute>
      <Layout>
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </Layout>
    </AuthRoute>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      {/* Admin — standalone (no layout) */}
      <Route path="/admin" component={Admin} />
      {/* Protected app routes */}
      <Route path="/app">
        <ProtectedLayout><Home /></ProtectedLayout>
      </Route>
      <Route path="/entries">
        <ProtectedLayout><Entries /></ProtectedLayout>
      </Route>
      <Route path="/entries-report">
        <ProtectedLayout><EntriesReport /></ProtectedLayout>
      </Route>
      <Route path="/credits">
        <ProtectedLayout><Credits /></ProtectedLayout>
      </Route>
      <Route path="/profits">
        <ProtectedLayout><Profits /></ProtectedLayout>
      </Route>
      <Route path="/reports">
        <ProtectedLayout><Reports /></ProtectedLayout>
      </Route>
      <Route path="/backup">
        <ProtectedLayout><Backup /></ProtectedLayout>
      </Route>
      <Route path="/settings">
        <ProtectedLayout><Settings /></ProtectedLayout>
      </Route>
      <Route path="/recycle-bin">
        <ProtectedLayout><RecycleBin /></ProtectedLayout>
      </Route>
      <Route path="/closing">
        <ProtectedLayout><Closing /></ProtectedLayout>
      </Route>
      <Route path="/digital-report">
        <ProtectedLayout><DigitalReport /></ProtectedLayout>
      </Route>
      {/* Inventory routes — each wrapped with PinGuard for individual protection */}
      <Route path="/inventory">
        <ProtectedLayout><Inventory /></ProtectedLayout>
      </Route>
      <Route path="/inventory/products">
        <ProtectedLayout>
          <PinGuard pageKey="products"><Products /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/bulk-purchase">
        <ProtectedLayout>
          <PinGuard pageKey="bulk-purchase"><BulkPurchase /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/purchase-bills">
        <ProtectedLayout>
          <PinGuard pageKey="purchase-bills"><PurchaseBills /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/product-sale">
        <ProtectedLayout>
          <PinGuard pageKey="product-sale"><ProductSale /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/product-return">
        <ProtectedLayout>
          <PinGuard pageKey="product-return"><ProductReturn /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/product-reports">
        <ProtectedLayout>
          <PinGuard pageKey="product-reports"><ProductReports /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/bill-settings">
        <ProtectedLayout><BillSettings /></ProtectedLayout>
      </Route>
      <Route path="/inventory/masters">
        <ProtectedLayout><Masters /></ProtectedLayout>
      </Route>
      <Route path="/inventory/company-replacements">
        <ProtectedLayout>
          <PinGuard pageKey="company-replacements"><CompanyReplacements /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/bulk-replacement">
        <ProtectedLayout>
          <PinGuard pageKey="company-replacements"><BulkReplacement /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/supplier-balance">
        <ProtectedLayout>
          <PinGuard pageKey="supplier-balance"><SupplierBalance /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/warranty-check">
        <ProtectedLayout><WarrantyCheck /></ProtectedLayout>
      </Route>
      <Route path="/inventory/quick-products">
        <ProtectedLayout><QuickProducts /></ProtectedLayout>
      </Route>
      <Route path="/inventory/product-history">
        <ProtectedLayout><ProductHistory /></ProtectedLayout>
      </Route>
      <Route path="/inventory/mobile-purchase">
        <ProtectedLayout>
          <PinGuard pageKey="mobile-purchase"><MobilePurchase /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route path="/inventory/bulk-mobile-purchase">
        <ProtectedLayout>
          <PinGuard pageKey="mobile-purchase"><BulkMobilePurchase /></PinGuard>
        </ProtectedLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        <PinProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Suspense fallback={<PageLoading fullScreen />}>
                <Router />
              </Suspense>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </PinProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
}

export default App;
