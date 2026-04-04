import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

const defaultForm = {
  quantity: '',
  purchase_price: '',
  expiry_date: '',
  batch_number: ''
};

export default function AddBatch() {
  const { storeId, productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [formValues, setFormValues] = useState(defaultForm);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      try {
        const { data } = await apiClient.get(`/stores/${storeId}/products/${productId}`);

        if (!isMounted) {
          return;
        }

        setProduct(data.product);
        setBatches(data.batches ?? []);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMessage(error.response?.data?.message ?? 'Unable to load product.');
        setStatus('error');
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId, storeId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      const { data } = await apiClient.post(`/stores/${storeId}/products/${productId}/batches`, formValues);
      setBatches((current) => [data.batch, ...current]);
      setFormValues(defaultForm);
      setMessage('Batch saved.');
      navigate(`/stores/${storeId}/inventory`, { replace: true });
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to add batch.');
    }
  };

  const showExpiryDate = Boolean(product?.trackExpiry);

  if (status === 'loading') {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-[1.5rem] bg-white/90 p-6 shadow-sm">Loading batch form...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f5efe2_0%,#fbfcf8_50%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.95fr]">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">Add Stock Batch</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">{product?.name ?? 'Product'}</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-200">
            Add incoming stock here. Expiry date is required only when the product tracks expiry.
          </p>
          <div className="mt-8 space-y-2 text-sm text-slate-200">
            <p>Stock now: {Number(product?.sellableStock ?? 0)}</p>
            <p>Track expiry: {product?.trackExpiry ? 'Yes' : 'No'}</p>
            <p>Unit: {product?.unitType ?? '—'} {product?.unitValue ?? ''}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink" to={`/stores/${storeId}/inventory`}>
              Back to inventory
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_rgba(31,122,77,0.12)]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Batch number</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="batch_number"
                value={formValues.batch_number}
                onChange={handleChange}
                placeholder="BATCH-001"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Quantity</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="quantity"
                type="number"
                min="1"
                step="1"
                value={formValues.quantity}
                onChange={handleChange}
                placeholder="24"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Purchase price</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="purchase_price"
                type="number"
                min="0"
                step="0.01"
                value={formValues.purchase_price}
                onChange={handleChange}
                placeholder="28.50"
              />
            </label>

            {showExpiryDate ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Expiry date</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="expiry_date"
                  type="date"
                  value={formValues.expiry_date}
                  onChange={handleChange}
                />
              </label>
            ) : null}

            {message ? (
              <div className="rounded-2xl border border-brand-ink/10 bg-brand-sand px-4 py-3 text-sm font-medium text-brand-ink">
                {message}
              </div>
            ) : null}

            <button className="w-full rounded-2xl bg-brand-leaf px-5 py-3 text-base font-semibold text-white transition hover:brightness-110" type="submit">
              Save batch
            </button>
          </form>

          <div className="mt-8">
            <h2 className="text-2xl font-black text-brand-ink">Existing batches</h2>
            <div className="mt-4 space-y-3">
              {batches.map((batch) => (
                <article key={batch.id} className="rounded-[1.5rem] border border-brand-ink/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-brand-ink">{batch.batchNumber}</p>
                      <p className="text-sm text-slate-600">Qty: {batch.quantity} · Available: {batch.availableQuantity}</p>
                      <p className="text-sm text-slate-600">Expiry: {batch.expiryDate ?? '—'}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {batch.expiryStatus}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
