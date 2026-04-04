import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { auth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import businessRouter from './routes/business.js';
import inventoryRouter from './routes/inventory.js';
import kioskRouter from './routes/kiosk.js';
import paymentsRouter from './routes/payments.js';
import reportsRouter from './routes/reports.js';
import transactionsRouter from './routes/transactions.js';
import storeRouter from './routes/stores.js';

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json());

const errorMessageByStatus = (statusCode, fallbackMessage) => {
  if (fallbackMessage) {
    return fallbackMessage;
  }

  switch (statusCode) {
    case 400:
      return 'Bad request.';
    case 401:
      return 'Authentication required.';
    case 403:
      return 'Forbidden.';
    case 404:
      return 'Not found.';
    default:
      return 'Request failed.';
  }
};

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    const statusCode = res.statusCode ?? 200;
    if (statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
      if ('success' in body) {
        return originalJson(body);
      }

      const message = errorMessageByStatus(statusCode, typeof body.message === 'string' ? body.message : undefined);
      return originalJson({
        success: false,
        message,
        code: statusCode
      });
    }

    return originalJson(body);
  };

  next();
});

app.use('/api/auth', authRouter);
app.use('/api/business', businessRouter);
app.use('/api/stores', storeRouter);
app.use('/api/stores', inventoryRouter);
app.use('/api/stores', transactionsRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/payments', paymentsRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'digital-retail-server'
  });
});

app.get('/api/test/protected', auth, (req, res) => {
  res.json({
    ok: true,
    message: 'Protected route reached successfully.',
    user: req.user
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(err.statusCode ?? 500).json({
    success: false,
    message: err.message ?? 'Internal server error.',
    code: err.code ?? err.statusCode ?? 500
  });
});
