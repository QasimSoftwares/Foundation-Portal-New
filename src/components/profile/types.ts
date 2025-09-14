import { z } from 'zod';

export const profileFormSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
  cnic_number: z.string()
    .regex(
      /^\d{5}-\d{7}-\d{1}$/,
      'CNIC must be in the format XXXXX-XXXXXXX-X'
    )
    .optional()
    .or(z.literal('')),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_number: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  communication_preference: z.enum(['email', 'phone', 'whatsapp']).default('email'),
  skills: z.string().optional(),
  skills_other: z.string().optional(),
  availability: z.enum(['on_site', 'remote']).default('on_site'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export type TabConfig = {
  id: string;
  label: string;
  component: React.ComponentType<{ form: any }>;
  roles?: string[];
};
