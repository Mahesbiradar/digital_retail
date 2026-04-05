import { BrowserMultiFormatReader } from '@zxing/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { kioskApiClient } from '../../api/kiosk.js';
import { useKioskStore } from '../../store/kioskStore.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

export default function KioskHome() {
  const { storeSlug } = useParams();
  const barcodeInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('loading');
  const [searchStatus, setSearchStatus] = useState('idle');

  const sessionId = useKioskStore((state) => state.sessionId);
  const store = useKioskStore((state) => state.store);
  const business = useKioskStore((state) => state.business);
  const products = useKioskStore((state) => state.products);
  const cart = useKioskStore((state) => state.cart);
  const searchQuery = useKioskStore((state) => state.searchQuery);
  const scannerMessage = useKioskStore((state) => state.scannerMessage);
  const errorMessage = useKioskStore((state) => state.errorMessage);
  const setSession = useKioskStore((state) => state.setSession);
  const setProducts = useKioskStore((state) => state.setProducts);
  const setSearchQuery = useKioskStore((state) => state.setSearchQuery);
  const setScannerMessage = useKioskStore((state) => state.setScannerMessage);
  const setErrorMessage = useKioskStore((state) => state.setErrorMessage);
  const setBusy = useKioskStore((state) => state.setBusy);
  const setCart = useKioskStore((state) => state.setCart);
  const computeTotals = useKioskStore((state) => state.computeTotals);
  const totals = useMemo(() => computeTotals(), [cart, business, computeTotals]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        setSessionStatus('loading');
        const { data } = await kioskApiClient.post(`/kiosk/${storeSlug}/session`, {
          sessionId: sessionId || undefined
        });

        if (!isMounted) {
          return;
        }

        setSession({
          storeSlug,
          sessionId: data.sessionId,
          store: data.store,
          business: data.business,
          cart: data.cart ?? []
        });
        setSessionStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error.response?.data?.message ?? 'Unable to start kiosk session.');
        setSessionStatus('error');
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId, setErrorMessage, setSession, storeSlug]);

  useEffect(() => {
    let isMounted = true;
    const query = searchQuery.trim();

    const runSearch = async () => {
      if (query.length < 2) {
        setProducts([]);
        return;
      }

      try {
        setSearchStatus('loading');
        const { data } = await kioskApiClient.get(`/kiosk/${storeSlug}/search`, {
          params: { q: query }
        });

        if (!isMounted) {
          return;
        }

        setProducts(data.products ?? []);
        setSearchStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error.response?.data?.message ?? 'Unable to search products.');
        setSearchStatus('error');
      }
    };

    const timer = window.setTimeout(runSearch, 250);
    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, setErrorMessage, setProducts, storeSlug]);

  useEffect(() => {
    if (!cameraOpen || !cameraVideoRef.current) {
      return undefined;
    }

    let isActive = true;
    const reader = new BrowserMultiFormatReader();

    const handleBarcodeLookup = async (code) => {
      const value = String(code ?? '').trim();
      if (!value) {
        return;
      }

      try {
        const { data } = await kioskApiClient.get(`/kiosk/${storeSlug}/barcode/${encodeURIComponent(value)}`);
        const productId = data.product?.id;
        if (!productId) {
          setScannerMessage('Barcode not linked to a store product.');
          return;
        }

        const result = await kioskApiClient.post(`/kiosk/${storeSlug}/cart/add`, {
          productId,
          quantity: 1
        });

        setCart(result.data.cart ?? []);
        setScannerMessage(`Added ${data.product.name} to cart.`);
      } catch (error) {
        setScannerMessage(error.response?.data?.message ?? 'Unable to scan barcode.');
      }
    };

    const startScanner = async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, cameraVideoRef.current, async (result, error) => {
          if (!isActive) {
            return;
          }

          if (result) {
            const code = result.getText();
            setCameraOpen(false);
            scannerControlsRef.current?.stop?.();
            scannerControlsRef.current = null;
            await handleBarcodeLookup(code);
            return;
          }

          if (error && error.name !== 'NotFoundException') {
            setScannerMessage(error.message ?? 'Unable to scan barcode.');
          }
        });

        if (isActive) {
          scannerControlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (error) {
        if (isActive) {
          setScannerMessage(error.message ?? 'Unable to start camera scan.');
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
  }, [cameraOpen, setScannerMessage, storeSlug]);

  const addProduct = async (productId) => {
    try {
      setBusy(true);
      const { data } = await kioskApiClient.post(`/kiosk/${storeSlug}/cart/add`, {
        productId,
        quantity: 1
      });

      setCart(data.cart ?? []);
      setScannerMessage('Item added to cart.');
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'Unable to add item.');
    } finally {
      setBusy(false);
    }
  };

  const handleBarcodeSubmit = async (event) => {
    event.preventDefault();
    const value = barcodeInputRef.current?.value ?? '';
    barcodeInputRef.current.value = '';

    try {
      setBusy(true);
      const { data } = await kioskApiClient.get(`/kiosk/${storeSlug}/barcode/${encodeURIComponent(String(value).trim())}`);
      if (!data.product?.id) {
        setScannerMessage('Barcode not found.');
        return;
      }

      const result = await kioskApiClient.post(`/kiosk/${storeSlug}/cart/add`, {
        productId: data.product.id,
        quantity: 1
      });

      setCart(result.data.cart ?? []);
      setScannerMessage(`Added ${data.product.name} to cart.`);
    } catch (error) {
      if (error.response?.status === 404) {
        setScannerMessage('Barcode not found.');
        return;
      }

      setScannerMessage(error.response?.data?.message ?? 'Unable to look up barcode.');
    } finally {
      setBusy(false);
    }
  };

  const filteredProducts = products;
  const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(31,122,77,0.18),transparent_25%),linear-gradient(160deg,#fffaf0_0%,#f5fbf6_48%,#eef7ef_100%)] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4">
        <header className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(22,33,62,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-leaf">Self checkout</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-ink">{store?.name ?? storeSlug}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {business?.name ?? 'Kirana store'} · Tap, scan, and pay on your phone.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-brand-sand px-4 py-3 text-sm font-semibold text-brand-ink">
            <span>{cartCount} item(s)</span>
            <span>{currency.format(totals.total)}</span>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {scannerMessage ? (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {scannerMessage}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_20px_50px_rgba(22,33,62,0.10)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Scan or search</p>
              <h2 className="mt-1 text-xl font-black text-brand-ink">Find your items</h2>
            </div>
            <button
              className="rounded-2xl bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => setCameraOpen(true)}
            >
              Camera
            </button>
          </div>

          <form className="mt-4" onSubmit={handleBarcodeSubmit}>
            <input
              ref={barcodeInputRef}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
              placeholder="Scan barcode or type it here"
            />
          </form>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Search products</span>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
              placeholder="Search by name, brand, or SKU"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <div className="mt-4 space-y-3">
            {searchStatus === 'loading' ? <p className="text-sm text-slate-600">Searching...</p> : null}
            {sessionStatus === 'loading' ? <p className="text-sm text-slate-600">Starting session...</p> : null}
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-brand-ink/10 bg-brand-sand/40 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-brand-ink">{product.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {product.brand ?? 'No brand'} · Stock {Number(product.sellableStock ?? 0)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-brand-ink">{currency.format(Number(product.sellingPrice ?? 0))}</p>
                  <button
                    className="mt-2 rounded-2xl bg-brand-leaf px-4 py-2 text-xs font-semibold text-white"
                    type="button"
                    onClick={() => addProduct(product.id)}
                  >
                    Add
                  </button>
                </div>
              </article>
            ))}

            {sessionStatus === 'ready' && filteredProducts.length === 0 && searchQuery.trim().length >= 2 ? (
              <p className="text-sm text-slate-600">No matching products found.</p>
            ) : null}
          </div>
        </section>

        <section className="mt-auto rounded-[2rem] border border-brand-ink/10 bg-brand-ink p-5 text-white shadow-[0_20px_50px_rgba(22,33,62,0.18)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Cart</p>
              <p className="mt-1 text-sm text-slate-200">{cartCount} item(s)</p>
            </div>
            <Link className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink" to={`/shop/${storeSlug}/cart`}>
              Open cart
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-lg font-black">
            <span>Total</span>
            <span>{currency.format(totals.total)}</span>
          </div>
        </section>
      </div>

      {cameraOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/75 px-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-brand-ink">Scan barcode</h2>
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                type="button"
                onClick={() => setCameraOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Point the camera at a product barcode and it will add to your cart.</p>
            <video ref={cameraVideoRef} className="mt-4 w-full rounded-[1.5rem] bg-black" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
