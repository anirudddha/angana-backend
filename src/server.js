// src/server.js
import 'dotenv/config'; // loads .env automatically
import { app } from './app.js';

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
