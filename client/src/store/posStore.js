import { create } from 'zustand';

const clampQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
};

const initialState = {
  storeId: null,
  store: null,
  business: null,
  products: [],
  cart: [],
  searchQuery: '',
  discountAmount: 0,
  receipt: null,
  paymentOrder: null,
  scannerOpen: false,
  scannerMessage: '',
  activeBarcode: '',
  isCheckingOut: false,
  errorMessage: ''
};

export const usePosStore = create((set, get) => ({
  ...initialState,
  setSession: ({ storeId, store, business }) => set({ storeId, store, business }),
  setProducts: (products) => set({ products: Array.isArray(products) ? products : [] }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setScannerOpen: (scannerOpen) => set({ scannerOpen }),
  setScannerMessage: (scannerMessage) => set({ scannerMessage }),
  setActiveBarcode: (activeBarcode) => set({ activeBarcode }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setReceipt: (receipt) => set({ receipt }),
  setPaymentOrder: (paymentOrder) => set({ paymentOrder }),
  setCheckoutState: (isCheckingOut) => set({ isCheckingOut }),
  clearSale: () =>
    set((state) => ({
      ...initialState,
      storeId: state.storeId,
      store: state.store,
      business: state.business,
      products: state.products
    })),
  addItem: (product, batch) =>
    set((state) => {
      const existing = state.cart.find((item) => item.productId === product.id);
      const availableQuantity = Number(batch?.availableQuantity ?? product.sellableStock ?? 1);

      if (existing) {
        return {
          cart: state.cart.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, item.availableQuantity)
                }
              : item
          )
        };
      }

      return {
        cart: [
          ...state.cart,
          {
            productId: product.id,
            name: product.name,
            brand: product.brand,
            batchId: batch?.id ?? null,
            batchNumber: batch?.batchNumber ?? null,
            quantity: 1,
            availableQuantity,
            unitPrice: Number(product.sellingPrice ?? 0),
            gstRate: Number(product.gstRate ?? 0),
            trackExpiry: Boolean(product.trackExpiry)
          }
        ]
      };
    }),
  removeItem: (productId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.productId !== productId)
    })),
  updateQty: (productId, quantity) =>
    set((state) => ({
      cart: state.cart
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(clampQuantity(quantity), item.availableQuantity) }
            : item
        )
        .filter((item) => item.quantity > 0)
    })),
  applyDiscount: (amount) => set({ discountAmount: Math.max(0, Number(amount) || 0) }),
  computeTotals: () => {
    const { cart, discountAmount, business } = get();
    const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discount = business?.discountEnabled ? Math.min(discountAmount, subtotal) : 0;
    const tax = business?.gstEnabled
      ? cart.reduce((sum, item) => sum + item.quantity * item.unitPrice * (Number(item.gstRate ?? 0) / 100), 0)
      : 0;

    return {
      subtotal,
      discount,
      tax,
      total: subtotal - discount + tax
    };
  }
}));
