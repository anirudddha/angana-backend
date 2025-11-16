// src/app.js
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import apiRoutes from './api/index.js'; // make sure this file exists

const app = express();

// -------------------------------
// Middleware
// -------------------------------
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());

// -------------------------------
// Health Check
// -------------------------------
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Neighborhood Connect API is running!' });
});

// -------------------------------
// API Routes
// -------------------------------
app.use('/api/v1', apiRoutes);

// -------------------------------
// Global Error Handler
// -------------------------------
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);

export { app };
