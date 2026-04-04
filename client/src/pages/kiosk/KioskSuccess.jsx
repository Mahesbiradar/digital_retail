import { Link, useParams } from 'react-router-dom';
import { useKioskStore } from '../../store/kioskStore.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

export default function KioskSuccess() {
  const { storeSlug } = useParams();
  const { receipt, clearFlow } = useKioskStore((state) => ({
    receipt: state.receipt,
    clearFlow: state.clearFlow
  }));

  const transaction = receipt?.transaction ?? null;

  const startNewOrder = () => {
    clearFlow();
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#fffaf0_0%,#f5fbf6_48%,#eef7ef_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4">
        <section className="rounded-[2rem] border border-white/70 bg-white/95 p-6 text-center shadow-[0_20px_50px_rgba(22,33,62,0.12)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✓
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-leaf">Payment complete</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-ink">Thanks for shopping</h1>
          <p className="mt-3 text-sm text-slate-600">
            Your order has been confirmed and the store is updated immediately.
          </p>
        </section>

        <section className="rounded-[2rem] border border-brand-ink/10 bg-brand-ink p-5 text-white shadow-[0_20px_50px_rgba(22,33,62,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Receipt</p>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Transaction</span>
              <span className="font-semibold text-white">{transaction?.transactionNumber ?? 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-semibold text-white">{transaction?.status ?? 'completed'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base">
              <span>Total</span>
              <span className="font-black text-white">{currency.format(Number(transaction?.totalAmount ?? 0))}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-3">
          <button
            className="rounded-2xl bg-brand-leaf px-4 py-3 text-sm font-semibold text-white"
            type="button"
            onClick={startNewOrder}
          >
            Start new order
          </button>
          <Link
            className="rounded-2xl border border-brand-ink/10 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-ink"
            to={`/shop/${storeSlug}`}
            onClick={startNewOrder}
          >
            Back to shop
          </Link>
        </div>
      </div>
    </main>
  );
}
