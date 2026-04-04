import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { apiClient } from '../../api/axios.js';
import { useAuthStore } from '../../store/authStore.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const numberFormat = new Intl.NumberFormat('en-IN');

const summaryCardConfig = [
  { key: 'storeCount', label: 'Stores' },
  { key: 'productCount', label: 'Products' },
  { key: 'activeProductCount', label: 'Active products' },
  { key: 'transactionsToday', label: 'Transactions today' },
  { key: 'lowStockProductCount', label: 'Low stock products' },
  { key: 'kioskTransactionsToday', label: 'Kiosk checkouts' }
];

export default function DashboardHome() {
  const user = useAuthStore((state) => state.user);
  const business = useAuthStore((state) => state.business);
  const logout = useAuthStore((state) => state.logout);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reportStatus, setReportStatus] = useState('loading');
  const [reportError, setReportError] = useState('');
  const [summary, setSummary] = useState(null);
  const [summarySalesSeries, setSummarySalesSeries] = useState([]);
  const [salesReport, setSalesReport] = useState(null);
  const [stockReport, setStockReport] = useState(null);
  const [gstReport, setGstReport] = useState(null);
  const [recentKioskOrders, setRecentKioskOrders] = useState([]);
  const socketUrl = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

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

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      try {
        setReportStatus('loading');
        setReportError('');

        const [summaryResponse, salesResponse, stockResponse, gstResponse] = await Promise.allSettled([
          apiClient.get('/reports/dashboard-summary'),
          apiClient.get('/reports/sales', { params: { days: 14 } }),
          apiClient.get('/reports/stock-expiry'),
          business?.gstEnabled ? apiClient.get('/reports/gst') : Promise.resolve({ data: null })
        ]);

        if (!isMounted) {
          return;
        }

        if (summaryResponse.status === 'fulfilled') {
          setSummary(summaryResponse.value.data.summary ?? null);
          setSummarySalesSeries(summaryResponse.value.data.salesSeries ?? []);
        } else {
          throw summaryResponse.reason;
        }

        if (salesResponse.status === 'fulfilled') {
          setSalesReport(salesResponse.value.data);
        }

        if (stockResponse.status === 'fulfilled') {
          setStockReport(stockResponse.value.data);
        }

        if (gstResponse.status === 'fulfilled') {
          setGstReport(gstResponse.value.data);
        } else if (business?.gstEnabled) {
          setGstReport(null);
        }

        setReportStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setReportError(error.response?.data?.message ?? 'Unable to load reports.');
        setReportStatus('error');
      }
    };

    if (profile?.business?.id || business?.id) {
      loadReports();
    }

    return () => {
      isMounted = false;
    };
  }, [business?.gstEnabled, business?.id, profile?.business?.id]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    const socket = io(socketUrl, {
      transports: ['websocket'],
      auth: {
        token: accessToken
      }
    });

    socket.on('kiosk_transaction', (payload) => {
      setRecentKioskOrders((current) => [
        {
          id: payload.transaction?.id ?? `${Date.now()}`,
          storeName: payload.storeName ?? 'Kiosk sale',
          transactionNumber: payload.transaction?.transactionNumber ?? 'N/A',
          totalAmount: Number(payload.transaction?.totalAmount ?? 0),
          completedAt: payload.transaction?.completedAt ?? new Date().toISOString()
        },
        ...current
      ].slice(0, 10));
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, socketUrl]);

  const kioskFeed = useMemo(() => recentKioskOrders, [recentKioskOrders]);
  const salesSeries = salesReport?.series ?? summarySalesSeries;
  const maxSales = Math.max(...salesSeries.map((entry) => Number(entry.salesAmount ?? 0)), 1);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(233,138,21,0.18),transparent_26%),linear-gradient(135deg,#f4efe6_0%,#f9fbf5_48%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="flex flex-col gap-6 rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_rgba(22,33,62,0.12)] md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-leaf">Protected Dashboard</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-ink">Operations at a glance.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
              Summary cards, live kiosk activity, and business reports for sales, stock, expiry, and GST.
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">Local Session</p>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold text-brand-ink">Name:</span> {user?.name}</p>
              <p><span className="font-semibold text-brand-ink">Phone:</span> {user?.phone}</p>
              <p><span className="font-semibold text-brand-ink">Role:</span> {user?.role}</p>
              <p><span className="font-semibold text-brand-ink">Business:</span> {business?.name}</p>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-brand-ink p-6 text-white shadow-[0_18px_45px_rgba(22,33,62,0.18)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">Protected API Check</p>

            {status === 'loading' ? <p className="mt-5 text-sm text-slate-200">Checking `/api/auth/me`...</p> : null}
            {status === 'error' ? <p className="mt-5 text-sm font-medium text-red-200">{errorMessage}</p> : null}

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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCardConfig.map((card) => (
            <article
              key={card.key}
              className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">{card.label}</p>
              <p className="mt-3 text-3xl font-black text-brand-ink">
                {summary ? numberFormat.format(Number(summary[card.key] ?? 0)) : '—'}
              </p>
            </article>
          ))}
          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Sales today</p>
            <p className="mt-3 text-3xl font-black text-brand-ink">{summary ? currency.format(Number(summary.salesToday ?? 0)) : '—'}</p>
          </article>
          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Expiring batches</p>
            <p className="mt-3 text-3xl font-black text-brand-ink">
              {summary ? numberFormat.format(Number(summary.expiringSoonBatches ?? 0) + Number(summary.expiredBatches ?? 0)) : '—'}
            </p>
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">Sales report</p>
              <h2 className="mt-2 text-2xl font-black text-brand-ink">Sales trend</h2>
              <p className="mt-2 text-sm text-slate-600">
                Last {salesSeries.length} days of completed sales. {salesReport?.totals ? `Average ticket ${currency.format(Number(salesReport.totals.averageTicket ?? 0))}.` : ''}
              </p>
            </div>
            <div className="text-sm text-slate-600">
              {salesReport?.totals ? (
                <p>
                  Total {currency.format(Number(salesReport.totals.salesTotal ?? 0))} across{' '}
                  {numberFormat.format(Number(salesReport.totals.transactionCount ?? 0))} transactions
                </p>
              ) : null}
            </div>
          </div>

          {reportStatus === 'loading' ? <p className="mt-5 text-sm text-slate-600">Loading reports...</p> : null}
          {reportStatus === 'error' ? <p className="mt-5 text-sm font-medium text-red-700">{reportError}</p> : null}

          <div className="mt-5 grid gap-3">
            {salesSeries.map((entry) => {
              const amount = Number(entry.salesAmount ?? 0);
              const width = Math.max((amount / maxSales) * 100, amount > 0 ? 8 : 2);

              return (
                <div key={entry.day} className="grid grid-cols-[92px_1fr_110px] items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {new Date(entry.day).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <div className="h-3 rounded-full bg-brand-sand">
                    <div
                      className="h-3 rounded-full bg-brand-leaf transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="text-right text-sm font-semibold text-brand-ink">
                    {currency.format(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">Stock report</p>
            <h2 className="mt-2 text-2xl font-black text-brand-ink">Low stock and expiry watch</h2>
            <div className="mt-5 space-y-3">
              {(stockReport?.products ?? []).slice(0, 8).map((product) => (
                <article
                  key={product.id}
                  className="rounded-[1.25rem] border border-brand-ink/10 bg-brand-sand/35 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-ink">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {product.brand ?? 'No brand'} · Stock {Number(product.sellableStock ?? 0)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-ink">
                      {product.status === 'out_of_stock'
                        ? 'Out'
                        : product.status === 'low_stock'
                          ? 'Low'
                          : product.status === 'expiring_soon'
                            ? 'Expiry'
                            : 'OK'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>Total stock {Number(product.totalStock ?? 0)}</span>
                    <span>Expiring soon {Number(product.expiringSoonBatches ?? 0)}</span>
                    <span>Expired {Number(product.expiredBatches ?? 0)}</span>
                  </div>
                </article>
              ))}

              {stockReport?.products?.length === 0 ? (
                <p className="text-sm text-slate-600">No stock issues found.</p>
              ) : null}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">GST report</p>
            <h2 className="mt-2 text-2xl font-black text-brand-ink">Tax summary</h2>

            {business?.gstEnabled ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.25rem] bg-brand-ink px-4 py-4 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-brand-saffron">Gross sales</p>
                    <p className="mt-2 text-2xl font-black">
                      {gstReport ? currency.format(Number(gstReport.summary?.grossSales ?? 0)) : '—'}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-brand-leaf px-4 py-4 text-white">
                    <p className="text-xs uppercase tracking-[0.18em] text-brand-saffron">GST collected</p>
                    <p className="mt-2 text-2xl font-black">
                      {gstReport ? currency.format(Number(gstReport.summary?.gstCollected ?? 0)) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(gstReport?.rates ?? []).map((row) => (
                    <article key={row.gstRate} className="rounded-[1.25rem] border border-slate-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-brand-ink">{Number(row.gstRate ?? 0)}% GST</p>
                          <p className="mt-1 text-xs text-slate-500">{numberFormat.format(Number(row.unitsSold ?? 0))} units sold</p>
                        </div>
                        <div className="text-right text-sm text-slate-700">
                          <p className="font-semibold text-brand-ink">{currency.format(Number(row.gstAmount ?? 0))}</p>
                          <p>{currency.format(Number(row.taxableAmount ?? 0))} taxable</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                GST reporting is unavailable because GST is disabled for this business.
              </div>
            )}
          </article>
        </section>

        <section className="rounded-[1.75rem] border border-brand-ink/10 bg-white/90 p-6 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">Live kiosk feed</p>
          <h2 className="mt-3 text-2xl font-black text-brand-ink">Recent public checkout events</h2>
          <p className="mt-2 text-sm text-slate-600">
            This listens for kiosk completions in real time so the dashboard can reflect new orders within a couple of seconds.
          </p>

          <div className="mt-5 space-y-3">
            {kioskFeed.length === 0 ? (
              <p className="text-sm text-slate-600">Waiting for the first kiosk order...</p>
            ) : (
              kioskFeed.map((order) => (
                <article
                  key={order.id}
                  className="flex items-center justify-between rounded-[1.25rem] border border-brand-ink/10 bg-brand-sand/40 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-brand-ink">{order.transactionNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">{order.storeName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-brand-ink">{currency.format(order.totalAmount)}</p>
                    <p className="text-xs text-slate-500">{new Date(order.completedAt).toLocaleTimeString()}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
