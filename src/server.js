// src/server.js
import 'dotenv/config';
import { createServer } from 'http';
import { app } from './app.js';
import { initializeSocketIO } from './real-time/connection.js'; // your socket setup file

// Load environment variables
const PORT = process.env.PORT || 8080;

// Create HTTP server from Express app
const httpServer = createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
initializeSocketIO(httpServer);

// Start the server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO is attached and listening.`);
});
