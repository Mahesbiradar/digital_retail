import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { auth } from './middleware/auth.js';
import authRouter from './routes/auth.js';

export const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json());
app.use('/api/auth', authRouter);

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
    message: err.message ?? 'Internal server error.'
  });
});
