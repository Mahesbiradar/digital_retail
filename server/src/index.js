import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
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

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const start = async () => {
  await checkPostgresConnection();
  await connectRedis();

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on ${env.BACKEND_URL}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

