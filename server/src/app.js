import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'digital-retail-server'
  });
});

