import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export default function ProtectedRoute() {
  const { accessToken, refreshToken, hasHydrated } = useAuthStore((state) => ({
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    hasHydrated: state.hasHydrated
  }));
  const location = useLocation();

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-sand px-6">
        <div className="rounded-[1.5rem] bg-white/90 px-6 py-4 text-sm font-semibold text-brand-ink shadow-lg">
          Loading your session...
        </div>
      </div>
    );
  }

  if (!accessToken && !refreshToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
