import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';
import { useAuthStore } from '../../store/authStore.js';

const downloadImage = async (url, filename) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

export default function StoreSettings() {
  const { storeId } = useParams();
  const setBusiness = useAuthStore((state) => state.setSession);
  const [store, setStore] = useState(null);
  const [business, setBusinessState] = useState(null);
  const [formValues, setFormValues] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    logoUrl: '',
    selfCheckoutEnabled: true,
    isActive: true
  });
  const [busy, setBusy] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadStore = async () => {
      try {
        const { data } = await apiClient.get(`/stores/${storeId}`);

        if (!isMounted) {
          return;
        }

        setStore(data.store);
        setBusinessState(data.business);
        setFormValues({
          name: data.store.name ?? '',
          phone: data.store.phone ?? '',
          addressLine1: data.store.addressLine1 ?? '',
          addressLine2: data.store.addressLine2 ?? '',
          city: data.store.city ?? '',
          state: data.store.state ?? '',
          pincode: data.store.pincode ?? '',
          logoUrl: data.store.logoUrl ?? '',
          selfCheckoutEnabled: Boolean(data.store.selfCheckoutEnabled),
          isActive: Boolean(data.store.isActive)
        });
        setBusy('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMessage(error.response?.data?.message ?? 'Unable to load store settings.');
        setBusy('error');
      }
    };

    loadStore();

    return () => {
      isMounted = false;
    };
  }, [storeId]);

  const qrDownloadName = useMemo(() => {
    if (!store?.storeSlug) {
      return 'store-qr.png';
    }

    return `${store.storeSlug}-qr.png`;
  }, [store?.storeSlug]);

  const handleStoreChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveStore = async (event) => {
    event.preventDefault();
    setMessage('');
    setBusy('saving');

    try {
      const { data } = await apiClient.patch(`/stores/${storeId}`, formValues);
      setStore(data.store);
      setBusy('ready');
      setMessage('Store details saved.');
    } catch (error) {
      setBusy('ready');
      setMessage(error.response?.data?.message ?? 'Unable to save store details.');
    }
  };

  const handleSaveBusiness = async (event) => {
    event.preventDefault();
    setMessage('');
    setBusy('saving');

    try {
      const { data } = await apiClient.patch('/business/me', {
        gstEnabled: business.gstEnabled,
        discountEnabled: business.discountEnabled
      });
      setBusinessState(data.business);
      setBusy('ready');
      setMessage('Business flags saved.');

      const currentSession = useAuthStore.getState();
      setBusiness({
        user: currentSession.user,
        business: data.business,
        accessToken: currentSession.accessToken,
        refreshToken: currentSession.refreshToken
      });
    } catch (error) {
      setBusy('ready');
      setMessage(error.response?.data?.message ?? 'Unable to save business settings.');
    }
  };

  if (busy === 'loading' || !store) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-[1.5rem] bg-white/90 p-6 shadow-sm">
          Loading store settings...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f5efe2_0%,#fbfcf8_50%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(22,33,62,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">
            Store Settings
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-brand-ink">{store.name}</h1>
          <p className="mt-3 text-slate-700">Store slug: {store.storeSlug}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-brand-ink px-4 py-2 text-sm font-semibold text-white" to="/stores">
              Back to stores
            </Link>
            <Link className="rounded-2xl bg-brand-leaf px-4 py-2 text-sm font-semibold text-white" to={`/stores/${storeId}/inventory`}>
              Inventory
            </Link>
            <Link className="rounded-2xl border border-brand-ink/15 px-4 py-2 text-sm font-semibold text-brand-ink" to={`/stores/${storeId}/employees`}>
              Employees
            </Link>
          </div>
        </section>

        {message ? (
          <div className="rounded-[1.5rem] bg-white/85 p-4 text-sm font-medium text-brand-ink shadow-sm">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <form className="rounded-[2rem] bg-white/90 p-8 shadow-[0_24px_60px_rgba(31,122,77,0.12)]" onSubmit={handleSaveStore}>
            <div className="mb-6">
              <h2 className="text-2xl font-black text-brand-ink">Edit store details</h2>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Store name</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="name" value={formValues.name} onChange={handleStoreChange} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Phone</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="phone" value={formValues.phone} onChange={handleStoreChange} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Address line 1</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="addressLine1" value={formValues.addressLine1} onChange={handleStoreChange} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Address line 2</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="addressLine2" value={formValues.addressLine2} onChange={handleStoreChange} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">City</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="city" value={formValues.city} onChange={handleStoreChange} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">State</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="state" value={formValues.state} onChange={handleStoreChange} />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Pincode</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="pincode" value={formValues.pincode} onChange={handleStoreChange} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Logo URL</span>
                <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" name="logoUrl" value={formValues.logoUrl} onChange={handleStoreChange} />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" name="selfCheckoutEnabled" checked={formValues.selfCheckoutEnabled} onChange={handleStoreChange} />
                <span className="text-sm font-semibold text-slate-700">Self checkout enabled</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" name="isActive" checked={formValues.isActive} onChange={handleStoreChange} />
                <span className="text-sm font-semibold text-slate-700">Store active</span>
              </label>
            </div>
            <button className="mt-6 rounded-2xl bg-brand-leaf px-5 py-3 text-sm font-semibold text-white" disabled={busy === 'saving'} type="submit">
              {busy === 'saving' ? 'Saving...' : 'Save store'}
            </button>
          </form>

          <section className="rounded-[2rem] bg-brand-ink p-8 text-white shadow-[0_24px_60px_rgba(22,33,62,0.25)]">
            <h2 className="text-2xl font-black">Business flags</h2>
            <p className="mt-3 text-slate-200">These flags control GST and discount behavior across billing screens.</p>

            <form className="mt-6 space-y-4" onSubmit={handleSaveBusiness}>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(business?.gstEnabled)}
                  onChange={(event) => setBusinessState((current) => ({ ...current, gstEnabled: event.target.checked }))}
                />
                <span className="text-sm font-semibold">GST enabled</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(business?.discountEnabled)}
                  onChange={(event) => setBusinessState((current) => ({ ...current, discountEnabled: event.target.checked }))}
                />
                <span className="text-sm font-semibold">Discount enabled</span>
              </label>
              <button className="rounded-2xl bg-brand-saffron px-5 py-3 text-sm font-semibold text-brand-ink" type="submit" disabled={busy === 'saving'}>
                Save business flags
              </button>
            </form>

            <div className="mt-8 rounded-[1.5rem] bg-white p-5 text-brand-ink">
              <h3 className="text-lg font-black">Permanent QR</h3>
              <p className="mt-2 text-sm text-slate-600">{store.qrCodeUrl ? 'QR code is ready for download.' : 'No QR code found.'}</p>
              {store.qrCodeUrl ? (
                <div className="mt-4 space-y-4">
                  <img alt={`${store.name} QR code`} className="mx-auto max-w-[220px] rounded-2xl border border-slate-200 p-2" src={store.qrCodeUrl} />
                  <button
                    className="w-full rounded-2xl bg-brand-ink px-4 py-3 text-sm font-semibold text-white"
                    type="button"
                    onClick={() => downloadImage(store.qrCodeUrl, qrDownloadName)}
                  >
                    Download QR code
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
