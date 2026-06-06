import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import CongratsDialog from "./components/CongratsDialog";

const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient();

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background bg-mesh">
      <div className="relative mb-6">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/30 animate-bounce-in">
          <svg className="h-7 w-7 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <div className="absolute inset-0 h-14 w-14 rounded-2xl bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-primary"
            style={{
              animation: 'bounce 1.4s infinite ease-in-out both',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  // Allow recovery hash to be processed by Supabase on the Auth page
  const hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    return <Auth />;
  }
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <CongratsDialog />
          <PwaInstallPrompt />
          <BrowserRouter>
            {/* Recovery links are handled in AuthRoute */}
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
