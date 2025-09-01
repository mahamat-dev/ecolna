import type { NextFunction, Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const limiter = new RateLimiterMemory({ points: 5, duration: 60 }); // 5 req/min per key

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'anon';
    await limiter.consume(key);
    next();
  } catch (_) {
    res.status(429).json({ error: { message: 'Too many requests' } });
  }
}