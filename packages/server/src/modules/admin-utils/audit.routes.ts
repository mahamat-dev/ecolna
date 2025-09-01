import { Router } from 'express';
import { requireAdmin } from '../../middlewares/rbac';
import { z } from 'zod';
import { AuditListQuery } from './dto';
import { listAudit } from './audit.service';
import { db } from '../../db/client';
import { auditLog } from '../../db/schema/audit';
import { eq } from 'drizzle-orm';

export const auditRouter = Router();
auditRouter.use(requireAdmin);

// GET /api/admin/audit
auditRouter.get('/', async (req, res) => {
  try {
    const q = AuditListQuery.parse(req.query);
    const result = await listAudit(q);
    res.json(result);
  } catch (err) {
    console.error('GET /admin/audit failed', err);
    
    // Handle validation errors
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: err.errors
        }
      });
    }
    
    return res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to fetch audit logs' 
      } 
    });
  }
});

// GET /api/admin/audit/:id (optional single audit log)
auditRouter.get('/:id', async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    
    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    if (!rows[0]) {
      return res.status(404).json({ 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Audit log not found' 
        } 
      });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /admin/audit/:id failed', err);
    
    // Handle validation errors
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid audit log ID',
          details: err.errors
        }
      });
    }
    
    return res.status(500).json({ 
      error: { 
        code: 'INTERNAL_ERROR', 
        message: 'Failed to fetch audit log' 
      } 
    });
  }
});