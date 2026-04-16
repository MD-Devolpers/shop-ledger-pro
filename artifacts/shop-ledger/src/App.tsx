import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
