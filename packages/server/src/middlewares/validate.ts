import type { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

export function validate<T extends ZodSchema<any>>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Validation error', details: parsed.error.flatten() } });
    }
    req.body = parsed.data;
    next();
  };
}