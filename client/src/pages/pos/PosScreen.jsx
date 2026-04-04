import { BrowserMultiFormatReader } from '@zxing/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';
import { useAuthStore } from '../../store/authStore.js';
import { usePosStore } from '../../store/posStore.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const getProductStatus = (product) => {
  if (Number(product.sellableStock ?? 0) <= 0) {
    return 'Out of stock';
  }

  if (Number(product.expiringSoonBatches ?? 0) > 0) {
    return 'Expiring soon';
  }

  return 'Ready';
};

const getProductTone = (product) => {
  if (Number(product.sellableStock ?? 0) <= 0) {
    return 'bg-red-100 text-red-700';
  }

  if (Number(product.expiringSoonBatches ?? 0) > 0) {
    return 'bg-amber-100 text-amber-800';
  }

  return 'bg-emerald-100 text-emerald-700';
};

export default function PosScreen() {
  const { storeId } = useParams();
  const barcodeInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const [summaryStatus, setSummaryStatus] = useState('loading');
  const [catalogStatus, setCatalogStatus] = useState('loading');
  const [cameraOpen, setCameraOpen] = useState(false);

  const {
    store,
    business,
    products,
    cart,
    searchQuery,
    discountAmount,
    receipt,
    paymentOrder,
    scannerMessage,
    isCheckingOut,
    errorMessage,
    setSession,
    setProducts,
    setSearchQuery,
    setScannerMessage,
    setScannerOpen,
    setActiveBarcode,
    addItem,
    removeItem,
    updateQty,
    applyDiscount,
    computeTotals,
    setPaymentOrder,
    setReceipt,
    setCheckoutState,
    setErrorMessage,
    clearSale
  } = usePosStore((state) => ({
    store: state.store,
    business: state.business,
    products: state.products,
    cart: state.cart,
    searchQuery: state.searchQuery,
    discountAmount: state.discountAmount,
    receipt: state.receipt,
    paymentOrder: state.paymentOrder,
    scannerMessage: state.scannerMessage,
    isCheckingOut: state.isCheckingOut,
    errorMessage: state.errorMessage,
    setSession: state.setSession,
    setProducts: state.setProducts,
    setSearchQuery: state.setSearchQuery,
    setScannerMessage: state.setScannerMessage,
    setScannerOpen: state.setScannerOpen,
    setActiveBarcode: state.setActiveBarcode,
    addItem: state.addItem,
    removeItem: state.removeItem,
    updateQty: state.updateQty,
    applyDiscount: state.applyDiscount,
    computeTotals: state.computeTotals,
    setPaymentOrder: state.setPaymentOrder,
    setReceipt: state.setReceipt,
    setCheckoutState: state.setCheckoutState,
    setErrorMessage: state.setErrorMessage,
    clearSale: state.clearSale
  }));

  const user = useAuthStore((state) => state.user);

  const totals = useMemo(() => computeTotals(), [cart, discountAmount, business, computeTotals]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        setSummaryStatus('loading');
        const { data } = await apiClient.get(`/stores/${storeId}/summary`);

        if (!isMounted) {
          return;
        }

        setSession({
          storeId,
          store: data.store,
          business: data.business
        });
        setSummaryStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error.response?.data?.message ?? 'Unable to load store summary.');
        setSummaryStatus('error');
      }
    };

    const loadProducts = async () => {
      try {
        setCatalogStatus('loading');
        const { data } = await apiClient.get(`/stores/${storeId}/products`);
        if (!isMounted) {
          return;
        }

        setProducts(data.products ?? []);
        setCatalogStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(error.response?.data?.message ?? 'Unable to load products.');
        setCatalogStatus('error');
      }
    };

    loadSession();
    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [storeId, setErrorMessage, setProducts, setSession]);

  useEffect(() => {
    const focusBarcodeInput = () => {
      barcodeInputRef.current?.focus();
    };

    focusBarcodeInput();
    window.addEventListener('click', focusBarcodeInput);
    return () => window.removeEventListener('click', focusBarcodeInput);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !cameraVideoRef.current) {
      return undefined;
    }

    let isActive = true;
    const reader = new BrowserMultiFormatReader();

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
  }, [cameraOpen]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.brand, product.sku]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  const selectedReceipt = receipt;

  const handleBarcodeLookup = async (barcode) => {
    const code = String(barcode ?? '').trim();

    if (!code) {
      return;
    }

    setActiveBarcode(code);

    try {
      const { data } = await apiClient.get(`/stores/${storeId}/catalog/barcode/${encodeURIComponent(code)}`);
      const catalogItem = data.product;
      const matchingProduct = products.find((product) => product.catalogId === catalogItem.id);

      if (!matchingProduct) {
        setScannerMessage(`No store product is linked to ${catalogItem.name}.`);
        return;
      }

      const detail = await apiClient.get(`/stores/${storeId}/products/${matchingProduct.id}`);
      const availableBatch = detail.data.batches?.find(
        (batch) => Number(batch.availableQuantity ?? 0) > 0 && batch.expiryStatus !== 'expired' && batch.expiryStatus !== 'disposed'
      );

      if (!availableBatch) {
        setScannerMessage('This item is currently unavailable.');
        return;
      }

      addItem(detail.data.product, availableBatch);
      setScannerMessage(`Added ${detail.data.product.name} to cart.`);
    } catch (error) {
      if (error.response?.status === 404) {
        setScannerMessage('Barcode not found in catalog.');
        return;
      }

      setScannerMessage(error.response?.data?.message ?? 'Unable to look up barcode.');
    }
  };

  const handleBarcodeSubmit = async (event) => {
    event.preventDefault();
    const value = barcodeInputRef.current?.value ?? '';
    barcodeInputRef.current.value = '';
    await handleBarcodeLookup(value);
  };

  const addProductToCart = async (product) => {
    try {
      const detail = await apiClient.get(`/stores/${storeId}/products/${product.id}`);
      const availableBatch = detail.data.batches?.find(
        (batch) => Number(batch.availableQuantity ?? 0) > 0 && batch.expiryStatus !== 'expired' && batch.expiryStatus !== 'disposed'
      );

      if (!availableBatch) {
        setScannerMessage('This item is currently unavailable.');
        return;
      }

      addItem(detail.data.product, availableBatch);
      setScannerMessage(`Added ${detail.data.product.name} to cart.`);
    } catch (error) {
      setScannerMessage(error.response?.data?.message ?? 'Unable to add product.');
    }
  };

  const handleCashCheckout = async () => {
    if (cart.length === 0) {
      setErrorMessage('Add at least one item before checkout.');
      return;
    }

    setCheckoutState(true);
    setErrorMessage('');
    setPaymentOrder(null);

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          batchId: item.batchId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        paymentMethod: 'cash',
        discountAmount: totals.discount,
        initiatedBy: user?.role === 'owner' ? 'owner' : 'cashier'
      };

      const { data } = await apiClient.post(`/stores/${storeId}/transactions`, payload);
      setReceipt(data);
      await refreshProducts();
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'Unable to complete cash checkout.');
    } finally {
      setCheckoutState(false);
    }
  };

  const handleUpiCheckout = async () => {
    if (cart.length === 0) {
      setErrorMessage('Add at least one item before checkout.');
      return;
    }

    setCheckoutState(true);
    setErrorMessage('');
    setReceipt(null);

    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          batchId: item.batchId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        paymentMethod: 'upi',
        discountAmount: totals.discount,
        initiatedBy: user?.role === 'owner' ? 'owner' : 'cashier'
      };

      const { data } = await apiClient.post(`/stores/${storeId}/transactions`, payload);
      setPaymentOrder(data.paymentOrder ?? null);
      setReceipt({
        transaction: data.transaction,
        items: data.items,
        payment: data.payment
      });
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'Unable to create UPI checkout.');
    } finally {
      setCheckoutState(false);
    }
  };

  const handleMockVerify = async () => {
    if (!paymentOrder?.orderId || !selectedReceipt?.transaction?.id) {
      return;
    }

    setCheckoutState(true);
    setErrorMessage('');

    try {
      const { data } = await apiClient.post('/payments/razorpay/verify', {
        transactionId: selectedReceipt.transaction.id,
        razorpay_order_id: paymentOrder.orderId,
        razorpay_payment_id: `mock_payment_${Date.now()}`,
        razorpay_signature: `mock_signature_${Date.now()}`
      });

      setReceipt({
        transaction: data.transaction,
        items: data.items ?? selectedReceipt.items,
        payment: data.payment
      });
      setPaymentOrder(null);
      await refreshProducts();
    } catch (error) {
      setErrorMessage(error.response?.data?.message ?? 'Unable to verify mock payment.');
    } finally {
      setCheckoutState(false);
    }
  };

  const refreshProducts = async () => {
    const { data } = await apiClient.get(`/stores/${storeId}/products`);
    setProducts(data.products ?? []);
  };

  const clearInvoice = async () => {
    clearSale();
    setErrorMessage('');
    setScannerMessage('');
    setPaymentOrder(null);
    setReceipt(null);
    setSearchQuery('');
    await refreshProducts();
    barcodeInputRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(31,122,77,0.22),transparent_24%),linear-gradient(135deg,#f4efe6_0%,#f9fbf5_48%,#eef7ef_100%)] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-[2rem] border border-white/60 bg-white/85 p-5 shadow-[0_24px_60px_rgba(22,33,62,0.12)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-saffron">Cashier POS</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-brand-ink">
                {store?.name ?? `Store ${storeId}`}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {business?.name ?? 'Business'} · {business?.gstEnabled ? 'GST on' : 'GST off'} ·{' '}
                {business?.discountEnabled ? 'Discounts on' : 'Discounts off'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-2xl bg-brand-ink px-4 py-2 text-sm font-semibold text-white"
                to="/stores"
              >
                Back to stores
              </Link>
              <button
                className="rounded-2xl bg-brand-leaf px-4 py-2 text-sm font-semibold text-white"
                type="button"
                onClick={() => setCameraOpen(true)}
              >
                Scan camera
              </button>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(22,33,62,0.10)]">
            <form className="space-y-3" onSubmit={handleBarcodeSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Barcode input</span>
                <input
                  ref={barcodeInputRef}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
                  placeholder="Scan with USB keyboard or type barcode"
                />
              </label>
            </form>

            {scannerMessage ? (
              <div className="rounded-2xl bg-brand-sand px-4 py-3 text-sm font-medium text-brand-ink">
                {scannerMessage}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Search products</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-saffron focus:ring-4 focus:ring-brand-saffron/10"
                placeholder="Search by name, brand, or SKU"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <article key={product.id} className="rounded-[1.5rem] border border-brand-ink/10 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-brand-ink">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.brand ?? 'No brand'}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getProductTone(product)}`}>
                      {getProductStatus(product)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <p>Stock: {Number(product.sellableStock ?? 0)}</p>
                    <p>Price: {currency.format(Number(product.sellingPrice ?? 0))}</p>
                  </div>
                  <button
                    className="mt-4 w-full rounded-2xl bg-brand-leaf px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={Number(product.sellableStock ?? 0) <= 0}
                    onClick={() => addProductToCart(product)}
                  >
                    Add to cart
                  </button>
                </article>
              ))}
            </div>

            {catalogStatus === 'loading' ? (
              <p className="text-sm text-slate-600">Loading products...</p>
            ) : null}

            {summaryStatus === 'error' || catalogStatus === 'error' ? null : null}
          </section>

          <aside className="space-y-4 rounded-[2rem] border border-brand-ink/10 bg-brand-ink p-5 text-white shadow-[0_24px_60px_rgba(22,33,62,0.16)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-saffron">Order summary</p>
              <h2 className="mt-2 text-2xl font-black">Cart</h2>
            </div>

            <div className="space-y-3">
              {cart.map((item) => (
                <article key={item.productId} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-slate-300">{item.batchNumber ?? 'FIFO batch'}</p>
                    </div>
                    <button
                      className="text-xs font-semibold text-red-200"
                      type="button"
                      onClick={() => removeItem(item.productId)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-xs text-slate-300">Qty</label>
                    <input
                      className="w-20 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm outline-none"
                      type="number"
                      min="1"
                      max={item.availableQuantity}
                      value={item.quantity}
                      onChange={(event) => updateQty(item.productId, event.target.value)}
                    />
                    <p className="ml-auto text-sm font-semibold">{currency.format(item.unitPrice * item.quantity)}</p>
                  </div>
                </article>
              ))}
            </div>

            {cart.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/20 p-4 text-sm text-slate-300">
                Your cart is empty. Scan or add a product to begin billing.
              </div>
            ) : null}

            <div className="space-y-3 rounded-[1.5rem] bg-white p-4 text-brand-ink">
              <div className="flex items-center justify-between text-sm">
                <span>Subtotal</span>
                <span>{currency.format(totals.subtotal)}</span>
              </div>
              {business?.discountEnabled ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Discount</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(event) => applyDiscount(event.target.value)}
                  />
                </label>
              ) : null}
              {business?.gstEnabled ? (
                <div className="flex items-center justify-between text-sm">
                  <span>GST</span>
                  <span>{currency.format(totals.tax)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-black">
                <span>Total</span>
                <span>{currency.format(totals.total)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-2xl bg-brand-saffron px-4 py-3 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isCheckingOut || cart.length === 0}
                onClick={handleCashCheckout}
              >
                Cash payment
              </button>
              <button
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isCheckingOut || cart.length === 0}
                onClick={handleUpiCheckout}
              >
                UPI payment
              </button>
            </div>

            {paymentOrder ? (
              <div className="rounded-[1.5rem] bg-white p-4 text-brand-ink">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-leaf">UPI QR</p>
                <p className="mt-2 text-sm text-slate-600">Order: {paymentOrder.orderId}</p>
                <p className="text-sm text-slate-600">Amount: {currency.format(paymentOrder.amount / 100)}</p>
                <img
                  alt="UPI QR code"
                  className="mt-4 mx-auto max-w-[220px] rounded-2xl border border-slate-200 p-2"
                  src={paymentOrder.upiQrDataUrl}
                />
                {paymentOrder.mode === 'mock' ? (
                  <button
                    className="mt-4 w-full rounded-2xl bg-brand-leaf px-4 py-3 text-sm font-semibold text-white"
                    type="button"
                    onClick={handleMockVerify}
                  >
                    Confirm mock payment
                  </button>
                ) : null}
              </div>
            ) : null}

            {selectedReceipt ? (
              <div className="rounded-[1.5rem] bg-white p-4 text-brand-ink">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-saffron">Receipt</p>
                    <p className="mt-1 font-black">{selectedReceipt.transaction.transactionNumber}</p>
                  </div>
                  <button
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold"
                    type="button"
                    onClick={clearInvoice}
                  >
                    New sale
                  </button>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>Status: {selectedReceipt.transaction.status}</p>
                  <p>Payment: {selectedReceipt.transaction.paymentStatus}</p>
                  <p>Total: {currency.format(selectedReceipt.transaction.totalAmount)}</p>
                </div>
                <div className="mt-4 space-y-2">
                  {selectedReceipt.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.productNameSnapshot}</span>
                      <span>{currency.format(item.lineTotalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      </div>

      {cameraOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/70 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-brand-ink">Camera barcode scan</h2>
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                type="button"
                onClick={() => setCameraOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">Scan a barcode with the camera and it will be added to the cart.</p>
            <video ref={cameraVideoRef} className="mt-5 w-full rounded-[1.5rem] bg-black" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
