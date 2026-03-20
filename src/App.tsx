import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RoleGuard, AdminGuard } from "@/components/RoleGuard";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import PvListPage from "@/pages/PvListPage";
import PvDetailPage from "@/pages/PvDetailPage";
import PvWizardPage from "@/pages/PvWizardPage";
import PvEditPage from "@/pages/PvEditPage";
import ExcelImportPage from "@/pages/ExcelImportPage";

import ReportsPage from "@/pages/ReportsPage";
import AnomaliesPage from "@/pages/AnomaliesPage";
import AuditPage from "@/pages/AuditPage";
import ReferencesPage from "@/pages/ReferencesPage";
import UsersManagementPage from "@/pages/UsersManagementPage";
import DatabaseBackupPage from "@/pages/DatabaseBackupPage";
import ExtraAiPage from "@/pages/ExtraAiPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/pv" element={<ProtectedRoute><PvListPage /></ProtectedRoute>} />
            <Route path="/pv/new" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "officer", "department_supervisor"]}>
                  <PvWizardPage />
                </RoleGuard>
              </ProtectedRoute>
            } />
            <Route path="/pv/:id" element={<ProtectedRoute><PvDetailPage /></ProtectedRoute>} />
            <Route path="/pv/:id/edit" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "officer", "department_supervisor"]}>
                  <PvEditPage />
                </RoleGuard>
              </ProtectedRoute>
            } />

            <Route path="/import/pdf" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "officer", "department_supervisor"]}>
                  <PdfImportPage />
                </RoleGuard>
              </ProtectedRoute>
            } />
            <Route path="/import/excel" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "officer", "department_supervisor"]}>
                  <ExcelImportPage />
                </RoleGuard>
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "national_supervisor", "department_supervisor"]}>
                  <ReportsPage />
                </RoleGuard>
              </ProtectedRoute>
            } />
            <Route path="/anomalies" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "national_supervisor", "department_supervisor"]}>
                  <AnomaliesPage />
                </RoleGuard>
              </ProtectedRoute>
            } />

            <Route path="/references" element={<ProtectedRoute><AdminGuard><ReferencesPage /></AdminGuard></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AdminGuard><UsersManagementPage /></AdminGuard></ProtectedRoute>} />
            <Route path="/audit" element={
              <ProtectedRoute>
                <RoleGuard allowedRoles={["admin", "national_supervisor"]}>
                  <AuditPage />
                </RoleGuard>
              </ProtectedRoute>
            } />
            <Route path="/backup" element={<ProtectedRoute><AdminGuard><DatabaseBackupPage /></AdminGuard></ProtectedRoute>} />
            <Route path="/extra-ai" element={<ProtectedRoute><AdminGuard><ExtraAiPage /></AdminGuard></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
