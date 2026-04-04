import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';
import { useAuthStore } from '../../store/authStore.js';

export default function DashboardHome() {
  const { user, business, logout } = useAuthStore((state) => ({
    user: state.user,
    business: state.business,
    logout: state.logout
  }));
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setStatus('loading');
        const { data } = await apiClient.get('/auth/me');

        if (!isMounted) {
          return;
        }

        setProfile(data);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error.response?.data?.message ?? 'Unable to load your dashboard profile.');
        setStatus('error');
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(233,138,21,0.18),transparent_26%),linear-gradient(135deg,#f4efe6_0%,#f9fbf5_48%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_rgba(22,33,62,0.12)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-leaf">
              Protected Dashboard
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-ink">
              Auth flow is active.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              This page is wrapped in the protected route and confirms the current
              access token can reach a secured API endpoint.
            </p>
          </div>

          <button
            className="rounded-2xl bg-brand-ink px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            type="button"
            onClick={() => logout()}
          >
            Log out
          </button>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-white/85 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">
              Local Session
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold text-brand-ink">Name:</span> {user?.name}</p>
              <p><span className="font-semibold text-brand-ink">Phone:</span> {user?.phone}</p>
              <p><span className="font-semibold text-brand-ink">Role:</span> {user?.role}</p>
              <p><span className="font-semibold text-brand-ink">Business:</span> {business?.name}</p>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-brand-ink p-6 text-white shadow-[0_18px_45px_rgba(22,33,62,0.18)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">
              Protected API Check
            </p>

            {status === 'loading' ? (
              <p className="mt-5 text-sm text-slate-200">Checking `/api/auth/me`...</p>
            ) : null}

            {status === 'error' ? (
              <p className="mt-5 text-sm font-medium text-red-200">{errorMessage}</p>
            ) : null}

            {status === 'ready' ? (
              <div className="mt-5 space-y-3 text-sm text-slate-100">
                <p><span className="font-semibold text-white">User ID:</span> {profile?.user?.id}</p>
                <p><span className="font-semibold text-white">Business ID:</span> {profile?.business?.id}</p>
                <p><span className="font-semibold text-white">GST Enabled:</span> {String(profile?.business?.gstEnabled)}</p>
                <p><span className="font-semibold text-white">Discount Enabled:</span> {String(profile?.business?.discountEnabled)}</p>
              </div>
            ) : null}
          </article>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link className="rounded-2xl bg-brand-leaf px-5 py-3 text-sm font-semibold text-white" to="/stores">
            Manage stores
          </Link>
          <Link className="rounded-2xl border border-brand-ink/15 bg-white px-5 py-3 text-sm font-semibold text-brand-ink" to="/stores/new">
            Create store
          </Link>
        </section>
      </div>
    </main>
  );
}
