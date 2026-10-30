import { z } from 'zod';
import { AMOUNT_INPUT_RE } from './money';

/** Form validation. Mirrors the API rules, so most mistakes never leave the browser. */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail')
  .email('E-mail inválido')
  .max(254);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(100, 'Máximo de 100 caracteres'),
    email,
    password: z.string().min(8, 'Mínimo de 8 caracteres').max(72, 'Máximo de 72 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const amountSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Informe o valor')
    .regex(AMOUNT_INPUT_RE, 'Use até 2 casas decimais, ex.: 1500,50')
    .refine((v) => /[1-9]/.test(v), 'O valor deve ser maior que zero'),
});
export type AmountForm = z.infer<typeof amountSchema>;
