import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { kioskApiClient } from '../../api/kiosk.js';
import { useKioskStore } from '../../store/kioskStore.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

export default function KioskCart() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [localError, setLocalError] = useState('');

  const cart = useKioskStore((state) => state.cart);
  const store = useKioskStore((state) => state.store);
  const business = useKioskStore((state) => state.business);
  const sessionId = useKioskStore((state) => state.sessionId);
  const setSession = useKioskStore((state) => state.setSession);
  const setCart = useKioskStore((state) => state.setCart);
  const setPaymentOrder = useKioskStore((state) => state.setPaymentOrder);
  const setReceipt = useKioskStore((state) => state.setReceipt);
  const setBusy = useKioskStore((state) => state.setBusy);
  const computeTotals = useKioskStore((state) => state.computeTotals);
  const totals = useMemo(() => computeTotals(), [cart, business, computeTotals]);

  useEffect(() => {
    let isMounted = true;

    const loadCart = async () => {
      try {
        setStatus('loading');
        const sessionResponse = await kioskApiClient.post(`/kiosk/${storeSlug}/session`, {
          sessionId: sessionId || undefined
        });

        if (!isMounted) {
          return;
        }

        setSession({
          storeSlug,
          sessionId: sessionResponse.data.sessionId,
          store: sessionResponse.data.store,
          business: sessionResponse.data.business,
          cart: sessionResponse.data.cart ?? []
        });

        const cartResponse = await kioskApiClient.get(`/kiosk/${storeSlug}/cart`);
        if (!isMounted) {
          return;
        }

        setCart(cartResponse.data.cart ?? []);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLocalError(error.response?.data?.message ?? 'Unable to load cart.');
        setStatus('error');
      }
    };

    loadCart();

    return () => {
      isMounted = false;
    };
  }, [sessionId, setCart, setSession, storeSlug]);

  const adjustQuantity = async (productId, direction) => {
    try {
      setBusy(true);
      const endpoint = direction === 'increase' ? 'add' : 'remove';
      const { data } = await kioskApiClient.post(`/kiosk/${storeSlug}/cart/${endpoint}`, {
        productId,
        quantity: 1
      });
      setCart(data.cart ?? []);
    } catch (error) {
      setLocalError(error.response?.data?.message ?? 'Unable to update cart.');
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    try {
      setBusy(true);
      setLocalError('');
      setPaymentOrder(null);

      const { data } = await kioskApiClient.post(`/kiosk/${storeSlug}/checkout`);
      setPaymentOrder(data.paymentOrder ?? null);
      setReceipt({
        transaction: data.transaction,
        items: data.items ?? [],
        payment: data.payment
      });
      navigate(`/shop/${storeSlug}/payment`);
    } catch (error) {
      setLocalError(error.response?.data?.message ?? 'Unable to start checkout.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#fffaf0_0%,#f5fbf6_48%,#eef7ef_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4">
        <header className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(22,33,62,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-leaf">Your cart</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-ink">{store?.name ?? 'Cart'}</h1>
            </div>
            <Link className="rounded-2xl bg-brand-ink px-4 py-2 text-sm font-semibold text-white" to={`/shop/${storeSlug}`}>
              Shop more
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-sand px-4 py-3 text-sm font-semibold text-brand-ink">
            <span>{cart.length} item(s)</span>
            <span>{currency.format(totals.total)}</span>
          </div>
        </header>

        {localError ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {localError}
          </div>
        ) : null}

        {status === 'loading' ? (
          <div className="rounded-[1.5rem] bg-white/80 p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading cart...
          </div>
        ) : null}

        <section className="space-y-3">
          {cart.map((item) => (
            <article
              key={item.productId}
              className="rounded-[1.5rem] border border-brand-ink/10 bg-white p-4 shadow-[0_10px_30px_rgba(22,33,62,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-brand-ink">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.brand ?? 'No brand'}</p>
                </div>
                <button
                  className="text-xs font-semibold text-red-600"
                  type="button"
                  onClick={() => adjustQuantity(item.productId, 'remove')}
                >
                  Remove
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 w-10 rounded-2xl border border-slate-200 text-lg font-black text-brand-ink"
                    type="button"
                    onClick={() => adjustQuantity(item.productId, 'remove')}
                  >
                    -
                  </button>
                  <div className="min-w-[3rem] text-center text-sm font-semibold text-brand-ink">
                    {item.quantity}
                  </div>
                  <button
                    className="h-10 w-10 rounded-2xl border border-slate-200 text-lg font-black text-brand-ink"
                    type="button"
                    onClick={() => adjustQuantity(item.productId, 'increase')}
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Line total</p>
                  <p className="text-base font-black text-brand-ink">
                    {currency.format(Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0))}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {status === 'ready' && cart.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/75 p-6 text-sm text-slate-600">
            Your cart is empty. Go back and scan or search for products.
          </div>
        ) : null}

        <section className="mt-auto rounded-[2rem] border border-brand-ink/10 bg-brand-ink p-5 text-white shadow-[0_20px_50px_rgba(22,33,62,0.18)]">
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{currency.format(totals.subtotal)}</span>
            </div>
            {business?.gstEnabled ? (
              <div className="flex items-center justify-between">
                <span>GST</span>
                <span>{currency.format(totals.tax)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-lg font-black">
            <span>Total</span>
            <span>{currency.format(totals.total)}</span>
          </div>

          <button
            className="mt-4 w-full rounded-2xl bg-brand-saffron px-4 py-3 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={cart.length === 0}
            onClick={checkout}
          >
            Pay by UPI
          </button>

          <Link
            className="mt-3 block rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white"
            to={`/shop/${storeSlug}`}
          >
            Continue shopping
          </Link>
        </section>
      </div>
    </main>
  );
}
