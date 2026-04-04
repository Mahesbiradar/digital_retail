import axios from 'axios';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.message ?? fallbackMessage;

const publicApi = axios.create({
  baseURL: API_BASE_URL
});

const initialState = {
  user: null,
  business: null,
  accessToken: null,
  refreshToken: null,
  hasHydrated: false
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      ...initialState,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      setTokens: ({ accessToken, refreshToken }) =>
        set((state) => ({
          accessToken: accessToken ?? state.accessToken,
          refreshToken: refreshToken ?? state.refreshToken
        })),
      setSession: ({ user, business, accessToken, refreshToken }) =>
        set({
          user,
          business,
          accessToken,
          refreshToken
        }),
      clearAuth: () => set({ ...initialState, hasHydrated: true }),
      signup: async (payload) => {
        try {
          const { data } = await publicApi.post('/auth/signup', payload);
          get().setSession(data);
          return data;
        } catch (error) {
          throw new Error(getErrorMessage(error, 'Unable to sign up right now.'));
        }
      },
      login: async (payload) => {
        try {
          const { data } = await publicApi.post('/auth/login', payload);
          get().setSession(data);
          return data;
        } catch (error) {
          throw new Error(getErrorMessage(error, 'Unable to log in right now.'));
        }
      },
      logout: async () => {
        const { refreshToken, clearAuth } = get();

        try {
          if (refreshToken) {
            await publicApi.post('/auth/logout', { refreshToken });
          }
        } finally {
          clearAuth();
        }
      }
    }),
    {
      name: 'digital-retail-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        business: state.business,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
