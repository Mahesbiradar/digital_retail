import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const publicApiClient = axios.create({
  baseURL: API_BASE_URL
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL
});

let refreshPromise = null;

export const refreshAccessToken = async () => {
  const { refreshToken, setTokens, clearAuth } = useAuthStore.getState();

  if (!refreshToken) {
    throw new Error('Missing refresh token.');
  }

  if (!refreshPromise) {
    refreshPromise = publicApiClient
      .post('/auth/refresh', { refreshToken })
      .then(({ data }) => {
        setTokens({
          accessToken: data.accessToken,
          refreshToken
        });

        return data.accessToken;
      })
      .catch((error) => {
        clearAuth();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();

  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`
    };
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/signup') ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      throw error;
    }

    if (!useAuthStore.getState().refreshToken) {
      throw error;
    }

    originalRequest._retry = true;

    const accessToken = await refreshAccessToken();

    originalRequest.headers = {
      ...originalRequest.headers,
      Authorization: `Bearer ${accessToken}`
    };

    return apiClient(originalRequest);
  }
);
