import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[^a-zA-Z0-9]/,
    'Password must contain at least one special character'
  )
  .refine(
    (value) => !value.includes(' '),
    'Password must not contain spaces'
  );

export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    return { valid: false, message: result.error.issues[0].message };
  }
  return { valid: true };
};

export const getPasswordStrength = (password: string): number => {
  let strength = 0;
  
  // Length check
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  
  // Character type checks
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
  
  // Deductions for common patterns
  if (/(.)\1{2,}/.test(password)) strength = Math.max(0, strength - 1);
  if (/(123|abc|qwerty|password)/i.test(password)) strength = Math.max(0, strength - 2);
  
  return Math.min(5, Math.max(0, strength));
};

export const getPasswordStrengthLabel = (strength: number): string => {
  if (strength <= 1) return 'Very Weak';
  if (strength === 2) return 'Weak';
  if (strength === 3) return 'Moderate';
  if (strength === 4) return 'Strong';
  return 'Very Strong';
};
