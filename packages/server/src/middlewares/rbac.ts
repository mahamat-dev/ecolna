import type { NextFunction, Request, Response } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sess: any = req.session as any;
  if (!sess || !sess.user) {
    return res.status(401).json({ error: { message: 'Not signed in' } });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sess: any = req.session as any;
  const user = sess?.user;
  if (!user) return res.status(401).json({ error: { message: 'Not signed in' } });
  if (!user.roles?.includes('ADMIN')) return res.status(403).json({ error: { message: 'Admin only' } });
  next();
}

export function requireStaffOrAdmin(req: Request, res: Response, next: NextFunction) {
  const sess: any = req.session as any;
  const user = sess?.user;
  if (!user) return res.status(401).json({ error: { message: 'Not signed in' } });
  const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
  if (!(roles.includes('ADMIN') || roles.includes('STAFF'))) {
    return res.status(403).json({ error: { message: 'Staff or Admin only' } });
  }
  next();
}