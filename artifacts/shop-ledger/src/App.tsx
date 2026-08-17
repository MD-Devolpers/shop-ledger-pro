import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { OfflineProvider } from "@/contexts/offline-context";
import { AuthRoute } from "@/components/auth-route";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import Admin from "@/pages/admin";
import Home from "@/pages/home";
import Entries from "@/pages/entries";
import Credits from "@/pages/credits";
import Profits from "@/pages/profits";
import Reports from "@/pages/reports";
import Backup from "@/pages/backup";
import Settings from "@/pages/settings";
import RecycleBin from "@/pages/recycle-bin";
import Closing from "@/pages/closing";
import DigitalReport from "@/pages/digital-report";
// Inventory
import Inventory from "@/pages/inventory/index";
import Products from "@/pages/inventory/products";
import PurchaseBills from "@/pages/inventory/purchase-bills";
import ProductSale from "@/pages/inventory/product-sale";
import ProductReturn from "@/pages/inventory/product-return";
import ProductReports from "@/pages/inventory/product-reports";
import BillSettings from "@/pages/inventory/bill-settings";
import Masters from "@/pages/inventory/masters";
import CompanyReplacements from "@/pages/inventory/company-replacements";
import SupplierBalance from "@/pages/inventory/supplier-balance";
import ProductHistory from "@/pages/inventory/product-history";
import BulkPurchase from "@/pages/inventory/bulk-purchase";
import BulkReplacement from "@/pages/inventory/bulk-replacement";
import WarrantyCheck from "@/pages/inventory/warranty-check";
import QuickProducts from "@/pages/inventory/quick-products";
import MobilePurchase from "@/pages/inventory/mobile-purchase";
import BulkMobilePurchase from "@/pages/inventory/bulk-mobile-purchase";
import { PinProvider } from "@/contexts/pin-context";
import PinGuard from "@/components/pin-guard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10000,
    },
  },
});

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthRoute>
      <Layout>{children}</Layout>
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
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </PinProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
}

export default App;
