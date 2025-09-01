import { z } from 'zod';

export const EmailLoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const IdLoginDto = z.object({
  loginId: z.string().min(2),
  secret: z.string().min(6),
});
export const CreateUserDto = z.object({
  role: z.enum(['ADMIN','STAFF','TEACHER','STUDENT','GUARDIAN']),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
}).refine((data) => {
  // Admin users require email and password (min 8 chars)
  if (data.role === 'ADMIN') {
    return data.email && data.password && data.password.length >= 8;
  }
  // Non-admin users require password (min 6 chars)
  return data.password && data.password.length >= 6;
}, {
  message: "Admin users require email and password (min 8 chars). Non-admin users require password (min 6 chars).",
  path: ['password']
});
export const UpdateStatusDto = z.object({ isActive: z.boolean() });

export const UpdateProfileDto = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  dob: z.coerce.date().optional(),
  photoUrl: z.string().url().optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  country: z.string().max(2).optional(),
});