import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import DashboardHome from './pages/dashboard/DashboardHome.jsx';
import CreateStore from './pages/stores/CreateStore.jsx';
import Employees from './pages/stores/Employees.jsx';
import PosScreen from './pages/pos/PosScreen.jsx';
import StoreList from './pages/stores/StoreList.jsx';
import StoreSettings from './pages/stores/StoreSettings.jsx';
import AddBatch from './pages/inventory/AddBatch.jsx';
import AddProduct from './pages/inventory/AddProduct.jsx';
import ExpiryAlerts from './pages/inventory/ExpiryAlerts.jsx';
import ProductList from './pages/inventory/ProductList.jsx';
import KioskCart from './pages/kiosk/KioskCart.jsx';
import KioskHome from './pages/kiosk/KioskHome.jsx';
import KioskPayment from './pages/kiosk/KioskPayment.jsx';
import KioskSuccess from './pages/kiosk/KioskSuccess.jsx';
import { useAuthStore } from './store/authStore.js';

function HomeRedirect() {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  if (!hasHydrated || user === undefined) {
    return null;
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function GuestRoute({ children }) {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  if (!hasHydrated || user === undefined) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/shop/:storeSlug" element={<KioskHome />} />
      <Route path="/shop/:storeSlug/cart" element={<KioskCart />} />
      <Route path="/shop/:storeSlug/payment" element={<KioskPayment />} />
      <Route path="/shop/:storeSlug/success" element={<KioskSuccess />} />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <Signup />
          </GuestRoute>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/stores" element={<StoreList />} />
        <Route path="/stores/new" element={<CreateStore />} />
        <Route path="/stores/:storeId" element={<StoreSettings />} />
        <Route path="/stores/:storeId/employees" element={<Employees />} />
        <Route path="/stores/:storeId/inventory" element={<ProductList />} />
        <Route path="/stores/:storeId/products/new" element={<AddProduct />} />
        <Route path="/stores/:storeId/products/:productId/batches" element={<AddBatch />} />
        <Route path="/stores/:storeId/expiry-alerts" element={<ExpiryAlerts />} />
        <Route path="/pos/:storeId" element={<PosScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
