import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { kioskApiClient } from '../../api/kiosk.js';
import { useKioskStore } from '../../store/kioskStore.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

export default function KioskPayment() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const [paymentId, setPaymentId] = useState('');
  const [signature, setSignature] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentOrder = useKioskStore((state) => state.paymentOrder);
  const receipt = useKioskStore((state) => state.receipt);
  const sessionId = useKioskStore((state) => state.sessionId);
  const setReceipt = useKioskStore((state) => state.setReceipt);

  const transaction = receipt?.transaction ?? null;
  const amount = useMemo(() => Number(paymentOrder?.amount ?? transaction?.totalAmount ?? 0) / 100, [paymentOrder, transaction]);

  const confirmPayment = async () => {
    if (!paymentOrder || !transaction) {
      setErrorMessage('Checkout again to create a payment request.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const isMockOrder = String(paymentOrder.orderId ?? '').startsWith('order_mock_');
      const { data } = await kioskApiClient.post(`/kiosk/${storeSlug}/confirm`, {
        transactionId: transaction.id,
        razorpay_order_id: paymentOrder.orderId,
        razorpay_payment_id: isMockOrder ? paymentId || `mock_payment_${Date.now()}` : paymentId,
        razorpay_signature: isMockOrder ? signature || `mock_signature_${Date.now()}` : signature,
        sessionId
      });

      setReceipt({
        transaction: data.transaction,
        items: data.items ?? receipt?.items ?? [],
        payment: data.payment
      });
      navigate(`/shop/${storeSlug}/success`);
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'Unable to confirm payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#fffaf0_0%,#f5fbf6_48%,#eef7ef_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4">
        <header className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(22,33,62,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-leaf">Secure payment</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-ink">Pay with UPI</h1>
          <p className="mt-2 text-sm text-slate-600">Open your banking app, pay the QR amount, then confirm here.</p>
        </header>

        {errorMessage ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-brand-ink/10 bg-white p-5 shadow-[0_20px_50px_rgba(22,33,62,0.10)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Order</p>
              <p className="mt-1 font-black text-brand-ink">{paymentOrder?.orderId ?? 'Awaiting checkout'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</p>
              <p className="text-lg font-black text-brand-ink">{currency.format(amount)}</p>
            </div>
          </div>

          {paymentOrder?.upiQrDataUrl ? (
            <img
              alt="UPI QR code"
              className="mx-auto mt-5 w-full max-w-[260px] rounded-[1.5rem] border border-slate-200 bg-white p-2"
              src={paymentOrder.upiQrDataUrl}
            />
          ) : null}

          <p className="mt-4 text-sm text-slate-600">
            Scan the QR code with any UPI app and complete the payment. Local development uses a mock confirmation flow.
          </p>

          {paymentOrder?.mode === 'mock' ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-brand-ink">Mock confirmation</p>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                placeholder="Optional mock payment id"
                value={paymentId}
                onChange={(event) => setPaymentId(event.target.value)}
              />
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                placeholder="Optional mock signature"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
              />
              <button
                className="w-full rounded-2xl bg-brand-leaf px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isSubmitting}
                onClick={confirmPayment}
              >
                Confirm payment
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                placeholder="Razorpay payment id"
                value={paymentId}
                onChange={(event) => setPaymentId(event.target.value)}
              />
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                placeholder="Razorpay signature"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
              />
              <button
                className="w-full rounded-2xl bg-brand-leaf px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isSubmitting}
                onClick={confirmPayment}
              >
                Confirm payment
              </button>
            </div>
          )}
        </section>

        <Link
          className="mt-auto rounded-[1.5rem] border border-brand-ink/10 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-ink shadow-[0_10px_30px_rgba(22,33,62,0.06)]"
          to={`/shop/${storeSlug}/cart`}
        >
          Back to cart
        </Link>
      </div>
    </main>
  );
}
