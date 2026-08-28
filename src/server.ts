import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { socketService } from './services/socketService.js';

const PORT = parseInt(env.PORT, 10) || 5000;

const server = http.createServer(app);

// Initialize Socket.io WebSockets Engine
socketService.init(server);

server.listen(PORT, () => {
  console.log(`🚀 Xion Backend Engine running on http://localhost:${PORT}`);
  console.log(`⚡ WebSockets Engine active on ws://localhost:${PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
});
