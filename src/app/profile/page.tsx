'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { profileFormSchema, ProfileFormValues } from '@/components/profile/types';
import { useUser } from '@/hooks/use-user';
import { skillOptions } from '@/constants/skills';

export default function ProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isLoading: isUserLoading } = useUser();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
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
      country: 'Pakistan',
      postal_code: '',
      communication_preference: 'email',
      skills: 'it',
      skills_other: '',
      availability: 'on_site',
    },
  });

  // Fetch user profile data
  const fetchProfile = useCallback(async () => {
    if (isUserLoading) return;
    
    try {
      if (!user) {
        console.error('No authenticated user');
        window.location.href = '/signin';
        return;
      }

      // Use the new get_complete_profile RPC
      console.log('Fetching profile data...');
      const { data: response, error } = await supabase
        .rpc('get_complete_profile');

      console.log('RPC Response:', { response, error });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (response?.success && response.data) {
        console.log('Profile data received:', response.data);
        const profileData = response.data;
        // Parse the address if it exists
        const address = typeof profileData.address === 'string' 
          ? JSON.parse(profileData.address) 
          : profileData.address || {};

        // Format CNIC with hyphens if it exists and is 13 digits
        const formattedCnic = profileData.cnic_number && profileData.cnic_number.length === 13
          ? `${profileData.cnic_number.substring(0, 5)}-${profileData.cnic_number.substring(5, 12)}-${profileData.cnic_number.substring(12)}`
          : profileData.cnic_number || '';
          
        // Set form values with the profile data, including defaults for new fields
        form.reset({
          full_name: profileData.full_name || '',
          phone_number: profileData.phone_number || '',
          cnic_number: formattedCnic,
          date_of_birth: profileData.date_of_birth || '',
          gender: profileData.gender || '',
          emergency_contact_name: profileData.emergency_contact_name || '',
          emergency_contact_number: profileData.emergency_contact_number || '',
          street: profileData.address?.street || '',
          city: profileData.address?.city || '',
          state: profileData.address?.state || '',
          country: profileData.address?.country || '',
          postal_code: profileData.address?.postal_code || '',
          communication_preference: profileData.communication_preference || 'email',
          availability: profileData.availability || 'on_site',
          skills: profileData.skills || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }, [form, user, isUserLoading]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (isSubmitting) return; // Prevent multiple submissions
    
    try {
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
      
      // Format CNIC by removing hyphens for database storage
      const formattedCnic = data.cnic_number ? data.cnic_number.replace(/-/g, '') : null;

      const { error } = await supabase.rpc('update_profile', {
        p_full_name: data.full_name,
        p_phone_number: data.phone_number || null,
        p_cnic_number: formattedCnic,
        p_date_of_birth: formattedDate,
        p_gender: data.gender || null,
        p_emergency_contact_name: data.emergency_contact_name || null,
        p_emergency_contact_number: data.emergency_contact_number || null,
        p_address: addressJson,
        p_communication_preference: data.communication_preference,
        p_skills: data.skills,
        p_skills_other: data.skills === 'other' ? data.skills_other : null,
        p_availability: data.availability
      });
      
      if (error) throw error;

      toast.success('Profile updated successfully', {
        duration: 4000,
        style: {
          background: '#10B981',
          color: '#FFFFFF',
          fontSize: '16px',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }
      });
      
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
      <h1 className="text-3xl font-bold mb-8">My Profile</h1>
      <ProfileTabs 
        form={form} 
        isSubmitting={isSubmitting} 
        onSubmit={onSubmit} 
      />
    </div>
  );
}
