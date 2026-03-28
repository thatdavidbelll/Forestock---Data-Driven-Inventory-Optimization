import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SuggestionsPage from './pages/SuggestionsPage'
import ProductsPage from './pages/ProductsPage'
import InventoryPage from './pages/InventoryPage'
import SalesPage from './pages/SalesPage'
import ImportPage from './pages/ImportPage'
import AdminPage from './pages/AdminPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import AuditLogPage from './pages/AuditLogPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import AcceptInvitePage from './pages/AcceptInvitePage'

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />

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
            <Route path="sales" element={<SalesPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="users" element={<AdminOnlyRoute><UsersPage /></AdminOnlyRoute>} />
            <Route path="audit" element={<AdminOnlyRoute><AuditLogPage /></AdminOnlyRoute>} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
