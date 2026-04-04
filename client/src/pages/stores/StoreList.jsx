import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

export default function StoreList() {
  const [stores, setStores] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadStores = async () => {
      try {
        const { data } = await apiClient.get('/stores');

        if (!isMounted) {
          return;
        }

        setStores(data.stores ?? []);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error.response?.data?.message ?? 'Unable to load stores.');
        setStatus('error');
      }
    };

    loadStores();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f6efe2_0%,#fbfcf8_45%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(22,33,62,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-leaf">
            Store Management
          </p>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-brand-ink">Your stores</h1>
              <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-700">
                Create stores, manage QR codes, and keep employee access organized from one place.
              </p>
            </div>
            <Link
              className="inline-flex rounded-2xl bg-brand-leaf px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              to="/stores/new"
            >
              Create store
            </Link>
          </div>
        </section>

        {status === 'loading' ? (
          <div className="rounded-[1.5rem] bg-white/80 p-6 text-sm font-medium text-slate-600 shadow-sm">
            Loading stores...
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {stores.map((store) => (
            <article
              key={store.id}
              className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">
                {store.storeSlug}
              </p>
              <h2 className="mt-3 text-2xl font-black text-brand-ink">{store.name}</h2>
              <p className="mt-3 text-sm text-slate-600">{store.phone ?? 'No phone added yet'}</p>
              <p className="mt-2 text-sm text-slate-600">
                Self checkout: {store.selfCheckoutEnabled ? 'Enabled' : 'Disabled'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Active: {store.isActive ? 'Yes' : 'No'}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="rounded-2xl bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
                  to={`/stores/${store.id}`}
                >
                  Settings
                </Link>
                <Link
                  className="rounded-2xl bg-brand-leaf px-4 py-2 text-sm font-semibold text-white"
                  to={`/stores/${store.id}/inventory`}
                >
                  Inventory
                </Link>
                <Link
                  className="rounded-2xl bg-brand-saffron px-4 py-2 text-sm font-semibold text-brand-ink"
                  to={`/pos/${store.id}`}
                >
                  POS
                </Link>
                <Link
                  className="rounded-2xl border border-brand-leaf/30 bg-brand-leaf/10 px-4 py-2 text-sm font-semibold text-brand-leaf"
                  to={`/shop/${store.storeSlug}`}
                >
                  Shop
                </Link>
                <Link
                  className="rounded-2xl border border-brand-ink/15 px-4 py-2 text-sm font-semibold text-brand-ink"
                  to={`/stores/${store.id}/employees`}
                >
                  Employees
                </Link>
              </div>
            </article>
          ))}
        </section>

        {status === 'ready' && stores.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white/80 p-6 text-sm font-medium text-slate-600 shadow-sm">
            No stores created yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}
