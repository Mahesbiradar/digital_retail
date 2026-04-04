import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/axios.js';

const badgeClasses = {
  out_of_stock: 'bg-red-100 text-red-700',
  expiring_soon: 'bg-amber-100 text-amber-800',
  in_stock: 'bg-emerald-100 text-emerald-700'
};

export default function ProductList() {
  const { storeId } = useParams();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        const { data } = await apiClient.get(`/stores/${storeId}/products`);

        if (!isMounted) {
          return;
        }

        setProducts(data.products ?? []);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMessage(error.response?.data?.message ?? 'Unable to load products.');
        setStatus('error');
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [storeId]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.brand, product.sku, product.unitType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f5efe2_0%,#fbfcf8_50%,#eef7ef_100%)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] bg-brand-ink px-8 py-10 text-white shadow-[0_30px_80px_rgba(22,33,62,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-saffron">Inventory</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">Products and stock levels</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-200">
            Search products, check stock health, and jump into adding stock batches before shelves run dry.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-brand-ink" to="/stores">
              Back to stores
            </Link>
            <Link className="rounded-2xl bg-brand-saffron px-4 py-2 text-sm font-semibold text-brand-ink" to={`/stores/${storeId}/products/new`}>
              Add product
            </Link>
            <Link className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white" to={`/stores/${storeId}/expiry-alerts`}>
              Expiry alerts
            </Link>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_rgba(31,122,77,0.08)]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Search products</span>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-leaf focus:ring-4 focus:ring-brand-leaf/10"
              placeholder="Search by name, brand, SKU, or unit"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </section>

        {status === 'loading' ? (
          <div className="rounded-[1.5rem] bg-white/85 p-6 text-sm font-medium text-slate-600 shadow-sm">
            Loading products...
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-brand-ink/10 bg-white/90 shadow-[0_24px_60px_rgba(22,33,62,0.10)]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-5 py-4">Product</th>
                <th className="px-5 py-4">Stock</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Price</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const stockStatus =
                  Number(product.sellableStock) <= 0
                    ? 'out_of_stock'
                    : Number(product.expiringSoonBatches) > 0
                      ? 'expiring_soon'
                      : 'in_stock';

                return (
                  <tr key={product.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="text-base font-black text-brand-ink">{product.name}</p>
                        <p className="text-sm text-slate-600">
                          {product.brand ?? 'No brand'} · {product.unitType ?? 'unit'}{' '}
                          {product.unitValue ?? ''}
                        </p>
                        <p className="text-xs text-slate-500">SKU: {product.sku ?? '—'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-brand-ink">{Number(product.sellableStock ?? 0)}</p>
                      <p className="text-slate-500">Total stock: {Number(product.totalStock ?? 0)}</p>
                      <p className="text-slate-500">Expired batches: {Number(product.expiredBatches ?? 0)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses[stockStatus]}`}>
                        {stockStatus === 'out_of_stock'
                          ? 'Out of stock'
                          : stockStatus === 'expiring_soon'
                            ? 'Expiring soon'
                            : 'In stock'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-brand-ink">MRP {product.mrp ?? '—'}</p>
                      <p className="text-slate-500">Selling {product.sellingPrice ?? '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-2xl bg-brand-leaf px-4 py-2 text-sm font-semibold text-white"
                          to={`/stores/${storeId}/products/${product.id}/batches`}
                        >
                          Add batch
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {status !== 'loading' && filteredProducts.length === 0 ? (
            <div className="border-t border-slate-100 px-5 py-8 text-sm text-slate-600">
              No products found.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
