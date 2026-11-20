import * as Sentry from '@sentry/react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { RequireAuth } from './routes/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { InsightsRoute } from './pages/BusinessOverviewPage'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { PlanSettingsPage } from './pages/PlanSettingsPage'
import { MediaLibraryPage } from './pages/MediaLibraryPage'
import { RecipeRedirectPage } from './pages/RecipeRedirectPage'
import { ProductionQueuePage } from './pages/ProductionQueuePage'
import { LabelQueuePage } from './pages/LabelQueuePage'
import { CourierDeliveriesPage } from './pages/CourierDeliveriesPage'
import { MarketExceptionsPage } from './pages/MarketExceptionsPage'
import { StockPage } from './pages/StockPage'
import { DeliveryCalendarPage } from './pages/DeliveryCalendarPage'
import { BillingPage } from './pages/BillingPage'
import { SubscriptionDetailPage } from './pages/SubscriptionDetailPage'
import { CouponsPage } from './pages/CouponsPage'
import { ShippingPage } from './pages/ShippingPage'
import { NutritionSimulatePage } from './pages/NutritionSimulatePage'
import { NutritionSettingsPage } from './pages/NutritionSettingsPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsersPage } from './pages/UsersPage'
import { RolesPage } from './pages/RolesPage'
import { CheckoutReadinessPage } from './pages/CheckoutReadinessPage'
import { PurchaseErrorsPage } from './pages/PurchaseErrorsPage'
import { UserDetailPage } from './pages/UserDetailPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { FeedbacksPage } from './pages/FeedbacksPage'
import { FeedbackFormPage } from './pages/FeedbackFormPage'
import { PrivacyRequestsPage } from './pages/PrivacyRequestsPage'
import { NfeDetailPage } from './pages/NfeDetailPage'
import { NfeListPage } from './pages/NfeListPage'
import { PrivacyRequestDetailPage } from './pages/PrivacyRequestDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

// The old 360 detail and /orders/:id both keyed on the user id; their content now lives in the customer's Checkout tab.
// The old lists (/onboarding/sessions, /orders) go to Clientes: checkouts are read per customer.
function LegacyCheckoutRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/users/${id}?aba=checkout` : '/users'} replace />
}

function ProtectedShell() {
  return (
    <RequireAuth>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </RequireAuth>
  )
}

// Admin only: other roles go back to Pendências before the page asks the API anything.
function AdminCheckoutReadinessRoute() {
  const { hasRole } = useAuth()
  return hasRole('admin') ? <CheckoutReadinessPage /> : <Navigate to="/dashboard" replace />
}

// purchase-error-monitor: admin only in the panel; other roles go back to Pendências before the page asks the API anything.
function PurchaseErrorsRoute() {
  const { hasRole } = useAuth()
  return hasRole('admin') ? <PurchaseErrorsPage /> : <Navigate to="/dashboard" replace />
}

// Market exceptions: admin only in the panel; other roles go back to Pendências before the page asks the API anything.
function MarketExceptionsRoute() {
  const { hasRole } = useAuth()
  return hasRole('admin') ? <MarketExceptionsPage /> : <Navigate to="/dashboard" replace />
}

// Loja › Plano: admin only in the panel; other roles go back to Pendências before the page asks the API anything.
function PlanSettingsRoute() {
  const { hasRole } = useAuth()
  return hasRole('admin') ? <PlanSettingsPage /> : <Navigate to="/dashboard" replace />
}

// Parâmetros nutricionais: admin and veterinarian only; other roles go back to Pendências before the page asks the API anything.
function NutritionSettingsRoute() {
  const { hasRole } = useAuth()
  return hasRole('admin') || hasRole('veterinarian') ? <NutritionSettingsPage /> : <Navigate to="/dashboard" replace />
}

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes)

function App() {
  return (
    <AuthProvider>
      <SentryRoutes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/operations/purchase-errors" element={<PurchaseErrorsRoute />} />
          <Route path="/operations/checkout-readiness" element={<AdminCheckoutReadinessRoute />} />
          <Route path="/insights" element={<InsightsRoute />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/detalhe" element={<ReportDetailPage />} />
          <Route path="/nutrition/simulate" element={<NutritionSimulatePage />} />
          <Route path="/nutrition/settings" element={<NutritionSettingsRoute />} />
          <Route path="/catalog/products" element={<ProductsPage />} />
          <Route path="/catalog/products/:productId" element={<ProductDetailPage />} />
          <Route path="/catalog/plan" element={<PlanSettingsRoute />} />
          <Route path="/catalog/media" element={<MediaLibraryPage />} />
          <Route path="/catalog/recipes" element={<Navigate to="/catalog/products" replace />} />
          <Route path="/catalog/recipes/:market/:recipeKey" element={<RecipeRedirectPage />} />
          <Route path="/onboarding/sessions" element={<Navigate to="/users" replace />} />
          <Route path="/onboarding/sessions/:id" element={<LegacyCheckoutRedirect />} />
          <Route path="/operations/production" element={<ProductionQueuePage />} />
          <Route path="/operations/labels" element={<LabelQueuePage />} />
          <Route path="/operations/courier" element={<CourierDeliveriesPage />} />
          <Route path="/operations/market-exceptions" element={<MarketExceptionsRoute />} />
          <Route path="/operations/stock" element={<StockPage />} />
          <Route path="/operations/delivery-calendar" element={<DeliveryCalendarPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/subscriptions/:id" element={<SubscriptionDetailPage />} />
          <Route path="/billing/coupons" element={<CouponsPage />} />
          <Route path="/config" element={<SettingsPage />} />
          <Route path="/config/shipping" element={<ShippingPage />} />
          <Route path="/config/business-rules" element={<Navigate to="/config/shipping" replace />} />
          <Route path="/feedbacks/new" element={<FeedbackFormPage />} />
          <Route path="/feedbacks/:id" element={<FeedbackFormPage />} />
          <Route path="/feedbacks" element={<FeedbacksPage />} />
          <Route path="/operations/nfe/:id" element={<NfeDetailPage />} />
          <Route path="/operations/nfe" element={<NfeListPage />} />
          <Route path="/privacy/requests/:id" element={<PrivacyRequestDetailPage />} />
          <Route path="/privacy/requests" element={<PrivacyRequestsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/roles" element={<RolesPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path="/account/password" element={<ChangePasswordPage />} />
          <Route path="/orders" element={<Navigate to="/users" replace />} />
          <Route path="/orders/:id" element={<LegacyCheckoutRedirect />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </SentryRoutes>
    </AuthProvider>
  )
}

export default App
