import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { useAuthStore } from './store/auth';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const StockExplorer = lazy(() => import('./pages/StockExplorer').then(m => ({ default: m.StockExplorer })));
const StockDetail = lazy(() => import('./pages/StockDetail').then(m => ({ default: m.StockDetail })));
const PortfolioBuilder = lazy(() => import('./pages/PortfolioBuilder').then(m => ({ default: m.PortfolioBuilder })));
const Radar = lazy(() => import('./pages/Radar').then(m => ({ default: m.Radar })));
const Recommendations = lazy(() => import('./pages/Recommendations').then(m => ({ default: m.Recommendations })));
const Watchlist = lazy(() => import('./pages/Watchlist').then(m => ({ default: m.Watchlist })));
const Layout = lazy(() => import('./components/Layout').then(m => ({ default: m.Layout })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60000,
    },
  },
});

const LoadingScreen = () => (
  <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="/stocks" element={<ProtectedRoute><Layout><StockExplorer /></Layout></ProtectedRoute>} />
            <Route path="/stocks/:symbol" element={<ProtectedRoute><Layout><StockDetail /></Layout></ProtectedRoute>} />
            <Route path="/portfolio" element={<ProtectedRoute><Layout><PortfolioBuilder /></Layout></ProtectedRoute>} />
            <Route path="/radar" element={<ProtectedRoute><Layout><Radar /></Layout></ProtectedRoute>} />
            <Route path="/recommendations" element={<ProtectedRoute><Layout><Recommendations /></Layout></ProtectedRoute>} />
            <Route path="/watchlist" element={<ProtectedRoute><Layout><Watchlist /></Layout></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
