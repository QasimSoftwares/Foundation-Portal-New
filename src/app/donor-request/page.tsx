'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { getRedirectPathForUser } from '@/lib/security/roles';

const formSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function DonorRequestPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      message: '',
    },
  });

  useEffect(() => {
    let isMounted = true;
    
    const checkAuthAndFetchProfile = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      try {
        // First check if we have a session (with a brief retry to avoid race conditions)
        let attempts = 0;
        let sessionError: any | null = null;
        let session: any | null = null;
        while (attempts < 3) {
          const res = await supabase.auth.getSession();
          session = res.data.session;
          sessionError = res.error;
          if (session && !sessionError) break;
          attempts += 1;
          await new Promise(r => setTimeout(r, 200));
        }
        
        if (sessionError || !session) {
          console.log('No active session after retries, redirecting to sign in with callback');
          window.location.href = `/signin?callbackUrl=${encodeURIComponent('/donor-request')}`;
          return;
        }
        
        // Then get the user (also retry briefly if needed)
        attempts = 0;
        let userError: any | null = null;
        let user: any | null = null;
        while (attempts < 3) {
          const res = await supabase.auth.getUser();
          user = res.data.user;
          userError = res.error;
          if (user && !userError) break;
          attempts += 1;
          await new Promise(r => setTimeout(r, 200));
        }
        
        if (userError || !user) {
          console.log('Failed to get user after retries, redirecting to sign in with callback');
          window.location.href = `/signin?callbackUrl=${encodeURIComponent('/donor-request')}`;
          return;
        }
        
        console.log('User authenticated, fetching profile...');

        // Fetch user profile data using the RPC function
        const { data: profileData, error: profileError } = await supabase
          .rpc('get_user_profile');
          
        // Get the first profile from the array
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          // Don't throw, just use empty values
          return;
        }
        
        // Debug: Log the profile data we received
        console.log('Profile data from RPC:', JSON.stringify(profile, null, 2));

        // Set form values with user data from RPC
        form.reset({
          fullName: profile?.full_name || '',
          email: profile?.email || user.email || '',
          phone: profile?.phone_number || '',  // Changed from phone to phone_number
          address: profile?.address || '',
          message: '',
        });
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your profile information. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndFetchProfile();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // First verify the user is still authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = `/signin?callbackUrl=${encodeURIComponent('/donor-request')}`;
        return;
      }

      const response = await fetch('/api/donor-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error?.message || 'Failed to submit donor request');
      }

      toast({
        title: 'Success',
        description: 'Your donor request has been submitted successfully!',
      });

      // Use window.location to ensure full page reload and proper auth state
      const redirectPath = await getRedirectPathForUser(session.user.id);
      window.location.href = redirectPath;
    } catch (error) {
      console.error('Error submitting donor request:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit donor request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Become a Donor</h1>
          <p className="text-muted-foreground mt-2">
            Fill out the form below to submit your request to become a donor.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Doe" 
                        readOnly 
                        className="bg-muted/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="john@example.com" 
                        readOnly 
                        className="bg-muted/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="+1 (555) 123-4567" 
                        readOnly 
                        className="bg-muted/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="123 Main St, City, Country" 
                        readOnly 
                        className="bg-muted/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us why you want to become a donor..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
