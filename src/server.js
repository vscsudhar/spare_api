import app from './app.js';
import env from './config/env.js';
import { connectDB, closeDB } from './config/db.js';
import { seedDatabase } from './database/seed.js';
import { initSocket } from './config/socket.js';

let server;

const startServer = async () => {
  // 1. Connect to Database
  await connectDB();

  // 2. Seed Database (Permissions, Roles, Owner)
  await seedDatabase(false);

  // 3. Start Listening
  const port = env.PORT || 5000;
  server = app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port} in ${env.NODE_ENV} mode`);
  });

  // Initialize Socket.IO binding
  initSocket(server);
};

// Handle process-level error events
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message, err.stack);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Handle graceful shutdown signals
const gracefulShutdown = (signal) => {
  console.log(`🔌 Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('🛑 Express HTTP server stopped');
      await closeDB();
      console.log('✅ Graceful shutdown completed. Exiting.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
