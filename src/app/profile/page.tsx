'use client';

import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription 
} from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

// Define form schema
const profileFormSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 digits').optional().or(z.literal('')),
  cnic_number: z.string().regex(/^\d{5}-\d{7}-\d{1}$/, 'CNIC must be in the format 12345-1234567-1').optional().or(z.literal('')),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_number: z.string().optional(),
  // Address fields
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: async () => {
      // This ensures proper typing for async default values
      return {
        full_name: '',
        phone_number: '',
        cnic_number: '',
        date_of_birth: '',
        gender: '',
        emergency_contact_name: '',
        emergency_contact_number: '',
        street: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
      };
    },
  });

  // Fetch user profile data
  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No active session:', sessionError);
        router.push('/signin');
        return;
      }

      // Use the new get_complete_profile RPC
      const { data: response, error } = await supabase
        .rpc('get_complete_profile');

      if (error) {
        throw error;
      }

      if (response?.success && response.data) {
        const profileData = response.data;
        // Parse the address if it exists
        const address = typeof profileData.address === 'string' 
          ? JSON.parse(profileData.address) 
          : profileData.address || {};

        const formData = {
          full_name: profileData.full_name || '',
          phone_number: profileData.phone_number || '',
          cnic_number: profileData.cnic_number || '',
          date_of_birth: profileData.date_of_birth 
            ? new Date(profileData.date_of_birth).toISOString().split('T')[0] 
            : '',
          gender: profileData.gender || '',
          emergency_contact_name: profileData.emergency_contact_name || '',
          emergency_contact_number: profileData.emergency_contact_number || '',
          // Address fields
          street: address?.street || '',
          city: address?.city || '',
          state: address?.state || address?.province || '',
          country: address?.country || '',
          postal_code: address?.postal_code || address?.zip || '',
        };
        
        form.reset(formData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [form, router, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    if (isSubmitting) return; // Prevent multiple submissions
    
    try {
      console.log('Form submitted with data:', data);
      setIsSubmitting(true);
      
      // Prepare address object
      const addressJson = {
        street: data.street || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        postal_code: data.postal_code || null,
      };

      // Format date to ISO string for the database (already in YYYY-MM-DD format from input)
      const formattedDate = data.date_of_birth || null;

      // Call the update_profile RPC
      console.log('Calling update_profile RPC with:', {
        p_full_name: data.full_name,
        p_phone_number: data.phone_number || null,
        p_cnic_number: data.cnic_number || null,
        p_date_of_birth: formattedDate,
        p_gender: data.gender || null,
        p_emergency_contact_name: data.emergency_contact_name || null,
        p_emergency_contact_number: data.emergency_contact_number || null,
        p_address: addressJson
      });
      
      const { data: result, error } = await supabase.rpc('update_profile', {
        p_full_name: data.full_name,
        p_phone_number: data.phone_number || null,
        p_cnic_number: data.cnic_number || null,
        p_date_of_birth: formattedDate,
        p_gender: data.gender || null,
        p_emergency_contact_name: data.emergency_contact_name || null,
        p_emergency_contact_number: data.emergency_contact_number || null,
        p_address: addressJson
      });

      console.log('RPC response:', { result, error });
      
      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      // Show a more prominent success message
      toast.success('Profile updated successfully', {
        duration: 4000, // Show for 4 seconds
        style: {
          background: '#10B981', // Green background
          color: '#FFFFFF', // White text
          fontSize: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }
      });
      
      // Refresh the form with the latest data
      await fetchProfile();
      
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            Update your personal information and contact details.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Full Name */}
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone Number */}
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+92 300 1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CNIC Number */}
              <FormField
                control={form.control}
                name="cnic_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNIC Number</FormLabel>
                    <FormControl>
                      <Input placeholder="12345-1234567-1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date of Birth */}
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gender */}
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value || ''}
                        onChange={field.onChange}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Emergency Contact Name */}
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Ali Khan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Emergency Contact Number */}
              <FormField
                control={form.control}
                name="emergency_contact_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+92 300 1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address Fields */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold col-span-full">Address</h3>
                
                <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Lahore" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="Punjab" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Pakistan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="54000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
