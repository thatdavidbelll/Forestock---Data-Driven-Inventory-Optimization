import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const SuggestionsPage = lazy(() => import('./pages/SuggestionsPage'))
const ProductsPage = lazy(() => import('./pages/ProductsPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage'))
const RequestStandaloneAccessPage = lazy(() => import('./pages/RequestStandaloneAccessPage'))
const ActivateStandaloneAccessPage = lazy(() => import('./pages/ActivateStandaloneAccessPage'))
const SlowMoversPage = lazy(() => import('./pages/SlowMoversPage'))

/** Root index redirect — super admins go to /admin, everyone else to /dashboard */
function RootRedirect() {
  const { role } = useAuth()
  return <Navigate to={role === 'ROLE_SUPER_ADMIN' ? '/admin' : '/dashboard'} replace />
}

/** Blocks regular users from accessing the super-admin panel */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'ROLE_SUPER_ADMIN') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Blocks non-admins from the user management page */
function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'ROLE_ADMIN') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminManagerRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'ROLE_ADMIN' && role !== 'ROLE_MANAGER') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div
                className="flex min-h-screen items-center justify-center"
                role="status"
                aria-label="Loading"
              >
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              </div>
            }
          >
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/request-standalone-access" element={<RequestStandaloneAccessPage />} />
              <Route path="/activate-standalone-access" element={<ActivateStandaloneAccessPage />} />

              {/* Protected routes — wrapped in Layout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<RootRedirect />} />

                {/* Super admin — platform management */}
                <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

                {/* Regular store routes */}
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="suggestions" element={<SuggestionsPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="slow-movers" element={<AdminManagerRoute><SlowMoversPage /></AdminManagerRoute>} />
                <Route path="sales" element={<SalesPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="users" element={<AdminOnlyRoute><UsersPage /></AdminOnlyRoute>} />
                <Route path="audit" element={<AdminOnlyRoute><AuditLogPage /></AdminOnlyRoute>} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}
