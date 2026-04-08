import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { PrivacyProvider } from "@/hooks/usePrivacy";
import { useTheme } from "@/hooks/useTheme";
import { LoadingScreen } from "@/components/ui/loading-spinner";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import NewAccount from "./pages/accounts/NewAccount";
import AccountDetail from "./pages/accounts/AccountDetail";
import EditAccount from "./pages/accounts/EditAccount";
import Transactions from "./pages/Transactions";
import NewTransaction from "./pages/transactions/NewTransaction";
import TransactionDetail from "./pages/transactions/TransactionDetail";
import EditTransaction from "./pages/transactions/EditTransaction";
import Categories from "./pages/Categories";
import Expenses from "./pages/expenses/Expenses";
import Recurring from "./pages/expenses/Recurring";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import CardDetail from "./pages/cards/CardDetail";
import NewPurchase from "./pages/cards/NewPurchase";
import Planning from "./pages/Planning";
import Onboarding from "./pages/Onboarding";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile, isLoading } = useProfile();

  // No bloquear si ya está en onboarding
  if (location.pathname === '/onboarding') return <>{children}</>;
  if (isLoading) return <LoadingScreen />;
  // Si el profile no existe todavía o no completó onboarding, redirigir
  if (profile && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
    {/* Onboarding (protected but outside AppLayout) */}
    <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

    {/* Protected routes (with onboarding guard) */}
    <Route element={<ProtectedRoute><OnboardingGuard><AppLayout /></OnboardingGuard></ProtectedRoute>}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/accounts/new" element={<NewAccount />} />
      <Route path="/accounts/:id" element={<AccountDetail />} />
      <Route path="/accounts/:id/edit" element={<EditAccount />} />
      <Route path="/cards/:id" element={<CardDetail />} />
      <Route path="/cards/:id/purchase/new" element={<NewPurchase />} />
      <Route path="/purchases/new" element={<NewPurchase />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/transactions/new" element={<NewTransaction />} />
      <Route path="/transactions/:id" element={<TransactionDetail />} />
      <Route path="/transactions/:id/edit" element={<EditTransaction />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/expenses/recurring" element={<Recurring />} />
      <Route path="/planning" element={<Planning />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/profile" element={<Profile />} />
    </Route>
    
    {/* Redirects */}
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

function ThemeInit({ children }: { children: React.ReactNode }) {
  useTheme(); // Aplica dark/light class al <html> según localStorage
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeInit>
          <AuthProvider>
            <PrivacyProvider>
              <AppRoutes />
            </PrivacyProvider>
          </AuthProvider>
        </ThemeInit>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
