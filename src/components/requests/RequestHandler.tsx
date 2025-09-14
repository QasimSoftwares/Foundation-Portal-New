"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithCSRF } from '@/lib/http/csrf-interceptor';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import RoleRequestForm from '@/components/requests/RoleRequestForm';

export type RoleRequestType = 'donor' | 'volunteer' | 'member';

interface RequestHandlerProps {
  type: RoleRequestType;
}

export function RequestHandler({ type }: RequestHandlerProps) {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; email: string; phone_number: string; address?: any } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Check existing status and fetch profile
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Check pending status
        const statusRes = await fetch(`/api/role-requests/status?type=${type}`, { method: 'GET', credentials: 'include' });
        if (!active) return;
        if (statusRes.status === 401) {
          router.replace('/signin');
          return;
        }
        const statusData = await statusRes.json();
        if (statusRes.ok) {
          const hasPending = Array.isArray(statusData.requests) && statusData.requests.some((r: any) => r.request_status === 'pending');
          setPending(hasPending);
          if (hasPending) {
            router.replace('/request/pending');
            return;
          }
        }

        // Fetch profile via RPC
        const { data, error } = await supabase.rpc('get_complete_profile');
        if (!active) return;
        if (error) {
          toast.error('Failed to load profile');
          setProfile(null);
        } else if (data && data.success && data.data) {
          setProfile({
            full_name: data.data.full_name || '',
            email: data.data.email || '',
            phone_number: data.data.phone_number || '',
            address: data.data.address || null,
          });
        }
      } catch {
        // Ignore; will show minimal form
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [type, router, toast]);

  const handleSubmit = async (notes: string) => {
    setSubmitting(true);
    try {
      const res = await fetchWithCSRF('/api/role-requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, notes }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Request submitted successfully');
        router.replace('/request/success');
        return;
      }
      if (res.status === 400 && (data.error || '').toLowerCase().includes('pending')) {
        toast.error('You already have a pending request.');
        router.replace('/request/pending');
        return;
      }
      toast.error(data.error || 'Failed to submit request');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-6 w-6 animate-spin border-2 border-gray-300 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <RoleRequestForm
      type={type}
      profile={profile}
      pending={pending}
      submitting={submitting}
      onSubmit={handleSubmit}
      onCancel={() => router.push('/dashboard')}
    />
  );
}

export default RequestHandler;
