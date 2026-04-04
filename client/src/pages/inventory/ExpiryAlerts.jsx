import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

export default function ExpiryAlerts() {
  const { storeId } = useParams();
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadAlerts = async () => {
      try {
        const { data } = await apiClient.get(`/stores/${storeId}/expiry-alerts`);

        if (!isMounted) {
          return;
        }

        setAlerts(data.alerts ?? []);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMessage(error.response?.data?.message ?? 'Unable to load expiry alerts.');
        setStatus('error');
      }
    };

    loadAlerts();

    return () => {
      isMounted = false;
    };
  }, [storeId]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f5efe2_0%,#fbfcf8_50%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">Expiry Watchlist</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Batches needing attention</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-200">
            Expiring and expired batches are tracked here so they can be reviewed before they reach the shelf.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink" to={`/stores/${storeId}/inventory`}>
              Back to inventory
            </Link>
          </div>
        </section>

        {status === 'loading' ? (
          <div className="rounded-[1.5rem] bg-white/85 p-6 text-sm font-medium text-slate-600 shadow-sm">
            Loading alerts...
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        <section className="space-y-4">
          {alerts.map((alert) => (
            <article key={alert.id} className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-lg font-black text-brand-ink">{alert.productName}</p>
                  <p className="mt-1 text-sm text-slate-600">Batch: {alert.batchNumber}</p>
                  <p className="mt-1 text-sm text-slate-600">Expiry date: {alert.expiryDate ?? '—'}</p>
                  <p className="mt-1 text-sm text-slate-600">Alert date: {alert.alertDate}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  {alert.expiryStatus}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-700">{alert.message}</p>
            </article>
          ))}
        </section>

        {status !== 'loading' && alerts.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white/85 p-6 text-sm font-medium text-slate-600 shadow-sm">
            No expiry alerts yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}
