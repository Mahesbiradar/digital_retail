import { BrowserMultiFormatReader } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

const defaultForm = {
  name: '',
  sellingPrice: '',
  unitType: '',
  unitValue: '',
  brand: '',
  description: '',
  mrp: '',
  gstRate: '',
  trackExpiry: false,
  isActive: true
};

const toFormValues = (catalogItem) => ({
  name: catalogItem?.name ?? '',
  sellingPrice: catalogItem?.mrp ?? '',
  unitType: catalogItem?.unitType ?? '',
  unitValue: catalogItem?.unitValue ?? '',
  brand: catalogItem?.brand ?? '',
  description: '',
  mrp: catalogItem?.mrp ?? '',
  gstRate: catalogItem?.gstRate ?? '',
  trackExpiry: false,
  isActive: true
});

export default function AddProduct() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [formValues, setFormValues] = useState(defaultForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) {
      return undefined;
    }

    let isActive = true;
    const reader = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (result, error) => {
          if (!isActive) {
            return;
          }

          if (result) {
            const code = result.getText();
            setScannerMessage(`Barcode found: ${code}`);
            scannerControlsRef.current?.stop?.();
            scannerControlsRef.current = null;
            setScannerOpen(false);
            await handleBarcodeLookup(code);
            return;
          }

          if (error && error.name !== 'NotFoundException') {
            setScannerMessage(error.message ?? 'Scanner error.');
          }
        });

        if (isActive) {
          scannerControlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (error) {
        if (isActive) {
          setScannerMessage(error.message ?? 'Unable to access the camera.');
        }
      }
    };

    startScanner();

    return () => {
      isActive = false;
      scannerControlsRef.current?.stop?.();
      scannerControlsRef.current = null;
      reader.reset();
    };
  }, [scannerOpen]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCatalogSearch = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      const { data } = await apiClient.get(`/stores/${storeId}/catalog/search`, {
        params: { q: catalogQuery }
      });

      setCatalogResults(data.items ?? []);
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to search catalog.');
    }
  };

  const applyCatalogItem = (catalogItem) => {
    setSelectedCatalog(catalogItem);
    setFormValues((current) => ({
      ...current,
      ...toFormValues(catalogItem)
    }));
  };

  const handleBarcodeLookup = async (barcode) => {
    const code = String(barcode ?? '').trim();
    if (!code) {
      return;
    }

    try {
      const { data } = await apiClient.get(`/stores/${storeId}/catalog/barcode/${encodeURIComponent(code)}`);
      applyCatalogItem(data.product);
      setCatalogResults([data.product]);
      setCatalogQuery(code);
      setMessage('Catalog item loaded from barcode.');
    } catch (error) {
      if (error.response?.status === 404) {
        setSelectedCatalog(null);
        setMessage('Barcode not found in catalog. You can still create a manual product.');
        return;
      }

      setMessage(error.response?.data?.message ?? 'Unable to look up barcode.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      const payload = {
        catalogId: selectedCatalog?.id ?? null,
        name: formValues.name,
        sellingPrice: formValues.sellingPrice,
        unitType: formValues.unitType || null,
        unitValue: formValues.unitValue || null,
        brand: formValues.brand || null,
        description: formValues.description || null,
        mrp: formValues.mrp || null,
        gstRate: formValues.gstRate || null,
        trackExpiry: Boolean(formValues.trackExpiry),
        isActive: Boolean(formValues.isActive)
      };

      await apiClient.post(`/stores/${storeId}/products`, payload);
      setMessage('Product created.');
      navigate(`/stores/${storeId}/inventory`);
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to create product.');
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f5efe2_0%,#fbfcf8_50%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">Add Product</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Search first, then create</h1>
          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-200">
            Find a catalog match by name or barcode, prefill the form, and create a store product in one flow.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink" to={`/stores/${storeId}/inventory`}>
              Back to inventory
            </Link>
            <button
              className="rounded-2xl bg-brand-saffron px-4 py-2 text-sm font-semibold text-brand-ink"
              type="button"
              onClick={() => setScannerOpen(true)}
            >
              Scan barcode
            </button>
          </div>

          <div className="mt-8 space-y-3 text-sm text-slate-200">
            <p>Selected catalog: {selectedCatalog?.name ?? 'None'}</p>
            <p>Barcode helper works for exact catalog lookups.</p>
            <p>Manual entry is always available if no catalog match exists.</p>
          </div>
        </section>

        <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_rgba(31,122,77,0.12)]">
          <form className="space-y-4" onSubmit={handleCatalogSearch}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Search catalog</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Search Tata Salt or scan a barcode"
              />
            </label>
            <button className="rounded-2xl bg-brand-leaf px-5 py-3 text-sm font-semibold text-white" type="submit">
              Search catalog
            </button>
          </form>

          {scannerMessage ? (
            <div className="rounded-2xl border border-brand-ink/10 bg-brand-sand px-4 py-3 text-sm font-medium text-brand-ink">
              {scannerMessage}
            </div>
          ) : null}

          <div className="space-y-3">
            {catalogResults.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-[1.5rem] border border-brand-ink/10 p-4 text-left transition hover:border-brand-leaf"
                type="button"
                onClick={() => applyCatalogItem(item)}
              >
                <p className="font-black text-brand-ink">{item.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.brand ?? 'No brand'} · Barcode: {item.barcode ?? '—'}
                </p>
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Product name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="name"
                  value={formValues.name}
                  onChange={handleChange}
                  placeholder="Tata Salt"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Brand</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="brand"
                  value={formValues.brand}
                  onChange={handleChange}
                  placeholder="Tata"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Selling price</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="sellingPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.sellingPrice}
                  onChange={handleChange}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">MRP</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="mrp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.mrp}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Unit type</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="unitType"
                  value={formValues.unitType}
                  onChange={handleChange}
                >
                  <option value="">Select unit type</option>
                  <option value="piece">Piece</option>
                  <option value="weight">Weight</option>
                  <option value="volume">Volume</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Unit value</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="unitValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.unitValue}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">GST rate</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="gstRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.gstRate}
                  onChange={handleChange}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Description</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
                  name="description"
                  value={formValues.description}
                  onChange={handleChange}
                  placeholder="Optional details"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" name="trackExpiry" checked={formValues.trackExpiry} onChange={handleChange} />
                <span className="text-sm font-semibold text-slate-700">Track expiry</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" name="isActive" checked={formValues.isActive} onChange={handleChange} />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
            </div>

            {message ? (
              <div className="rounded-2xl border border-brand-ink/10 bg-brand-sand px-4 py-3 text-sm font-medium text-brand-ink">
                {message}
              </div>
            ) : null}

            <button className="w-full rounded-2xl bg-brand-leaf px-5 py-3 text-base font-semibold text-white transition hover:brightness-110" type="submit">
              Create product
            </button>
          </form>
        </section>
      </div>

      {scannerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/70 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-brand-ink">Scan barcode</h2>
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                type="button"
                onClick={() => setScannerOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Point the camera at a barcode. The scanner will close as soon as a code is detected.
            </p>
            <video ref={videoRef} className="mt-5 w-full rounded-[1.5rem] bg-black" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
