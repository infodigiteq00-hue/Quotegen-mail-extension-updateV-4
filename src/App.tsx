import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GuestRoute } from "@/components/auth/GuestRoute";
import { AccountDisabledRoute } from "@/components/auth/AccountDisabledRoute";
import Index from "./pages/Index.tsx";
import Catalog from "./pages/Catalog.tsx";
import QuotationRecords from "./pages/QuotationRecords.tsx";
import QuotationDetail from "./pages/QuotationDetail.tsx";
import Trends from "./pages/Trends.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import AcceptInvite from "./pages/AcceptInvite.tsx";
import SuperadminDashboard from "./pages/SuperadminDashboard.tsx";

const queryClient = new QueryClient();

const ownerRoutes = (
  <>
    <Route
      path="/"
      element={
        <ProtectedRoute allowedRoles={["owner"]}>
          <Index />
        </ProtectedRoute>
      }
    />
    <Route
      path="/quote/:id"
      element={
        <ProtectedRoute allowedRoles={["owner"]}>
          <Index />
        </ProtectedRoute>
      }
    />
    <Route
      path="/records"
      element={
        <ProtectedRoute allowedRoles={["owner"]}>
          <QuotationRecords />
        </ProtectedRoute>
      }
    />
    <Route
      path="/records/:id"
      element={
        <ProtectedRoute allowedRoles={["owner"]}>
          <QuotationDetail />
        </ProtectedRoute>
      }
    />
    <Route
      path="/trends"
      element={
        <ProtectedRoute allowedRoles={["owner"]}>
          <Trends />
        </ProtectedRoute>
      }
    />
    <Route
      path="/catalog"
      element={
        <ProtectedRoute allowedRoles={["owner"]}>
          <Catalog />
        </ProtectedRoute>
      }
    />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/account-disabled" element={<AccountDisabledRoute />} />
            <Route
              path="/signup"
              element={
                <GuestRoute>
                  <Signup />
                </GuestRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["superadmin"]}>
                  <SuperadminDashboard />
                </ProtectedRoute>
              }
            />
            {ownerRoutes}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
