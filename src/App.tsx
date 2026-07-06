import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AuthProvider } from './contexts/AuthContext'
import { RequireAuth } from './routes/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductsPage } from './pages/ProductsPage'
import { PricingPage } from './pages/PricingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OnboardingSessionPage } from './pages/OnboardingSessionPage'
import { BillingPage } from './pages/BillingPage'
import { BusinessRulesPage } from './pages/BusinessRulesPage'
import { UsersPage } from './pages/UsersPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

function ProtectedShell() {
  return (
    <RequireAuth>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </RequireAuth>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catalog/products" element={<ProductsPage />} />
          <Route path="/catalog/pricing" element={<PricingPage />} />
          <Route path="/onboarding/sessions" element={<OnboardingPage />} />
          <Route path="/onboarding/sessions/:id" element={<OnboardingSessionPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/config/business-rules" element={<BusinessRulesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
