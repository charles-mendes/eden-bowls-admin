import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AuthProvider } from './contexts/AuthContext'
import { RequireAuth } from './routes/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { PricingPage } from './pages/PricingPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { OnboardingSessionPage } from './pages/OnboardingSessionPage'
import { BillingPage } from './pages/BillingPage'
import { SubscriptionDetailPage } from './pages/SubscriptionDetailPage'
import { CouponsPage } from './pages/CouponsPage'
import { ShippingPage } from './pages/ShippingPage'
import { NutritionSimulatePage } from './pages/NutritionSimulatePage'
import { UsersPage } from './pages/UsersPage'
import { RolesPage } from './pages/RolesPage'
import { UserDetailPage } from './pages/UserDetailPage'
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
          <Route path="/nutrition/simulate" element={<NutritionSimulatePage />} />
          <Route path="/catalog/products" element={<ProductsPage />} />
          <Route path="/catalog/products/:productId" element={<ProductDetailPage />} />
          <Route path="/catalog/pricing" element={<PricingPage />} />
          <Route path="/onboarding/sessions" element={<OnboardingPage />} />
          <Route path="/onboarding/sessions/:id" element={<OnboardingSessionPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/subscriptions/:id" element={<SubscriptionDetailPage />} />
          <Route path="/billing/coupons" element={<CouponsPage />} />
          <Route path="/config/shipping" element={<ShippingPage />} />
          <Route path="/config/business-rules" element={<Navigate to="/config/shipping" replace />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/roles" element={<RolesPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
