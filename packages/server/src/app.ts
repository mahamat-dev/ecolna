import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
const session = require('express-session');
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import apiRouter from './routes/index.ts';

const app = express();

// CORS with credentials
app.use(cors({
  origin: true,
  credentials: true
}));

// Core middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
};

// Use Redis store if REDIS_URL is provided
if (process.env.REDIS_URL) {
  const redisClient = new Redis(process.env.REDIS_URL);
  (sessionConfig as any).store = new RedisStore({ client: redisClient });
}

app.use(session(sessionConfig));

// Basic root
app.get('/', (_req: Request, res: Response) => {
  res.send('API is up');
});

// Mount API routes
app.use('/api', apiRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not Found' } });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: { message: 'Internal Server Error' } });
});

export default app;