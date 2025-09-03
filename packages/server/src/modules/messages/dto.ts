import { z } from 'zod';

export const SendMessageDto = z.object({
  recipients: z.array(z.string().uuid()).min(1),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().min(1),
});

export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

