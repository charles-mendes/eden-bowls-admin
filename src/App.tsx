import * as Sentry from '@sentry/react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { AuthProvider } from './contexts/AuthContext'
import { RequireAuth } from './routes/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { InsightsRoute } from './pages/BusinessOverviewPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { RecipeContentPage } from './pages/RecipeContentPage'
import { RecipesPage } from './pages/RecipesPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProductionQueuePage } from './pages/ProductionQueuePage'
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
import { UserDetailPage } from './pages/UserDetailPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { FeedbacksPage } from './pages/FeedbacksPage'
import { FeedbackFormPage } from './pages/FeedbackFormPage'
import { PrivacyRequestsPage } from './pages/PrivacyRequestsPage'
import { PrivacyRequestDetailPage } from './pages/PrivacyRequestDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

// The old 360 detail and /orders/:id both keyed on the user id; their content now lives in the customer's Checkout tab.
function LegacyCheckoutRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/users/${id}?aba=checkout` : '/onboarding/sessions'} replace />
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

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes)

function App() {
  return (
    <AuthProvider>
      <SentryRoutes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/insights" element={<InsightsRoute />} />
          <Route path="/nutrition/simulate" element={<NutritionSimulatePage />} />
          <Route path="/nutrition/settings" element={<NutritionSettingsPage />} />
          <Route path="/catalog/products" element={<ProductsPage />} />
          <Route path="/catalog/products/:productId" element={<ProductDetailPage />} />
          <Route path="/catalog/recipes" element={<RecipesPage />} />
          <Route path="/catalog/recipes/:market/:recipeKey" element={<RecipeContentPage />} />
          <Route path="/onboarding/sessions" element={<OnboardingPage />} />
          <Route path="/onboarding/sessions/:id" element={<LegacyCheckoutRedirect />} />
          <Route path="/operations/production" element={<ProductionQueuePage />} />
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
          <Route path="/privacy/requests/:id" element={<PrivacyRequestDetailPage />} />
          <Route path="/privacy/requests" element={<PrivacyRequestsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/roles" element={<RolesPage />} />
          <Route path="/users/:userId" element={<UserDetailPage />} />
          <Route path="/account/password" element={<ChangePasswordPage />} />
          <Route path="/orders" element={<Navigate to="/onboarding/sessions" replace />} />
          <Route path="/orders/:id" element={<LegacyCheckoutRedirect />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </SentryRoutes>
    </AuthProvider>
  )
}

export default App
