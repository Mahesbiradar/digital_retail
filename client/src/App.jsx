import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import DashboardHome from './pages/dashboard/DashboardHome.jsx';
import { useAuthStore } from './store/authStore.js';

function HomeRedirect() {
  const { accessToken, refreshToken, hasHydrated } = useAuthStore((state) => ({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    hasHydrated: state.hasHydrated
  }));

  if (!hasHydrated) {
    return null;
  }

  return <Navigate to={accessToken || refreshToken ? '/dashboard' : '/login'} replace />;
}

function GuestRoute({ children }) {
  const { accessToken, refreshToken, hasHydrated } = useAuthStore((state) => ({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    hasHydrated: state.hasHydrated
  }));

  if (!hasHydrated) {
    return null;
  }

  if (accessToken || refreshToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
