import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const initialState = {
  storeSlug: '',
  sessionId: '',
  store: null,
  business: null,
  products: [],
  cart: [],
  searchQuery: '',
  paymentOrder: null,
  receipt: null,
  scannerMessage: '',
  errorMessage: '',
  isBusy: false,
  hasHydrated: false
};

const clampQuantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
};

export const useKioskStore = create(
  persist(
    (set, get) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setSession: ({ storeSlug, sessionId, store, business, cart }) =>
        set({
          storeSlug,
          sessionId,
          store,
          business,
          cart: Array.isArray(cart) ? cart : []
        }),
      setSessionId: (sessionId) => set({ sessionId }),
      setStoreData: ({ store, business }) => set({ store, business }),
      setProducts: (products) => set({ products: Array.isArray(products) ? products : [] }),
      setCart: (cart) => set({ cart: Array.isArray(cart) ? cart : [] }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setPaymentOrder: (paymentOrder) => set({ paymentOrder }),
      setReceipt: (receipt) => set({ receipt }),
      setScannerMessage: (scannerMessage) => set({ scannerMessage }),
      setErrorMessage: (errorMessage) => set({ errorMessage }),
      setBusy: (isBusy) => set({ isBusy }),
      clearFlow: () =>
        set((state) => ({
          ...initialState,
          storeSlug: state.storeSlug,
          sessionId: state.sessionId,
          store: state.store,
          business: state.business,
          hasHydrated: true
        })),
      setItemQuantity: (productId, quantity) =>
        set((state) => ({
          cart: state.cart
            .map((item) =>
              item.productId === productId
                ? {
                    ...item,
                    quantity: clampQuantity(quantity)
                  }
                : item
            )
            .filter((item) => item.quantity > 0)
        })),
      computeTotals: () => {
        const { cart, business } = get();
        const subtotal = cart.reduce((sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0), 0);
        const tax = business?.gstEnabled
          ? cart.reduce(
              (sum, item) =>
                sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0) * (Number(item.gstRate ?? 0) / 100),
              0
            )
          : 0;

        return {
          subtotal,
          tax,
          total: subtotal + tax
        };
      }
    }),
    {
      name: 'digital-retail-kiosk',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        storeSlug: state.storeSlug,
        sessionId: state.sessionId,
        store: state.store,
        business: state.business,
        paymentOrder: state.paymentOrder,
        receipt: state.receipt
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
