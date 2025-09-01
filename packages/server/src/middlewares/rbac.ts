import type { NextFunction, Request, Response } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: { message: 'Not signed in' } });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ error: { message: 'Not signed in' } });
  if (!user.roles?.includes('ADMIN')) return res.status(403).json({ error: { message: 'Admin only' } });
  next();
}