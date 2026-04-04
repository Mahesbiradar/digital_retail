import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { startExpiryCron } from './jobs/expiryCron.js';
import { verifyAccessToken } from './lib/jwt.js';
import { checkPostgresConnection } from './lib/postgres.js';
import { connectRedis } from './lib/redis.js';

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true
  }
});

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next();
  }

  try {
    socket.data.user = verifyAccessToken(token);
  } catch (_error) {
    socket.data.user = null;
  }

  return next();
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  if (socket.data.user?.businessId) {
    socket.join(`business:${socket.data.user.businessId}`);
  }

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const start = async () => {
  await checkPostgresConnection();
  await connectRedis();
  startExpiryCron();

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on ${env.BACKEND_URL}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
