import { z } from 'zod';

export const optimizeRequestSchema = z.object({
  amount: z
    .number()
    .min(10000, 'Minimum investment is ₹10,000')
    .max(10000000, 'Maximum investment is ₹1,00,00,000'),
  days: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']),
});
