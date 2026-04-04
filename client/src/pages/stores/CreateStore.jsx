import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

const defaultForm = {
  name: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: ''
};

export default function CreateStore() {
  const [formValues, setFormValues] = useState(defaultForm);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [createdStore, setCreatedStore] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const { data } = await apiClient.post('/stores', formValues);
      setCreatedStore(data.store);
      setQrCodeDataUrl(data.qrCodeDataUrl ?? data.qrCodeUrl ?? '');
      setStatus('ready');
      navigate(`/stores/${data.store.id}`, { replace: true });
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'Unable to create store.');
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-brand-sand px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">
            New Store
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Create a store location</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">
            The store slug and permanent QR code are generated on save, then stored for future kiosk access.
          </p>
          <div className="mt-10 space-y-3 text-sm text-slate-200">
            <p>Slug example: ram-general-store-k7x2</p>
            <p>QR points to /shop/[store_slug]</p>
            <p>Cloudinary is used when configured, with a local fallback for dev</p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_rgba(31,122,77,0.12)]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Store name</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="name"
                value={formValues.name}
                onChange={handleChange}
                placeholder="Ram General Store"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Phone</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="phone"
                value={formValues.phone}
                onChange={handleChange}
                placeholder="9876543210"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Address line 1</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="addressLine1"
                value={formValues.addressLine1}
                onChange={handleChange}
                placeholder="Main Bazaar Road"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Address line 2</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="addressLine2"
                value={formValues.addressLine2}
                onChange={handleChange}
                placeholder="Near Market Gate"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">City</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="city"
                  value={formValues.city}
                  onChange={handleChange}
                  placeholder="Indore"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">State</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="state"
                  value={formValues.state}
                  onChange={handleChange}
                  placeholder="Madhya Pradesh"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Pincode</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                name="pincode"
                value={formValues.pincode}
                onChange={handleChange}
                placeholder="452001"
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              className="w-full rounded-2xl bg-brand-leaf px-5 py-3 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === 'loading'}
              type="submit"
            >
              {status === 'loading' ? 'Creating store...' : 'Create store'}
            </button>
          </form>

          {createdStore ? (
            <div className="mt-8 rounded-[1.5rem] bg-brand-sand p-4">
              <p className="text-sm font-semibold text-brand-ink">Created: {createdStore.name}</p>
              <p className="mt-1 text-sm text-slate-600">Slug: {createdStore.storeSlug}</p>
              <p className="mt-1 text-sm text-slate-600 break-all">
                QR: {qrCodeDataUrl ? 'Ready for download in settings' : createdStore.qrCodeUrl}
              </p>
            </div>
          ) : null}

          <div className="mt-6">
            <Link className="text-sm font-semibold text-brand-leaf" to="/stores">
              Back to store list
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
