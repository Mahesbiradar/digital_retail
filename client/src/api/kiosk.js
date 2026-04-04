import axios from 'axios';
import { useKioskStore } from '../store/kioskStore.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const kioskApiClient = axios.create({
  baseURL: API_BASE_URL
});

kioskApiClient.interceptors.request.use((config) => {
  const { sessionId } = useKioskStore.getState();

  if (sessionId) {
    config.headers = {
      ...config.headers,
      'x-kiosk-session-id': sessionId
    };
  }

  return config;
});
