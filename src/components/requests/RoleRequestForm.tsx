"use client";

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export type RoleRequestType = 'donor' | 'volunteer' | 'member';

export interface RoleRequestFormProps {
  type: RoleRequestType;
  profile: { full_name: string; email: string; phone_number: string; address?: any } | null;
  pending: boolean;
  submitting: boolean;
  onSubmit: (notes: string) => void | Promise<void>;
  onCancel: () => void;
}

function formatAddress(address: any): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object') {
    if ('raw' in address && address.raw) return String(address.raw);
    const { street, city, state, postal_code, country } = address as any;
    return [street, city, state, postal_code, country].filter(Boolean).join(', ');
  }
  return '';
}

export default function RoleRequestForm({ type, profile, pending, submitting, onSubmit, onCancel }: RoleRequestFormProps) {
  const [notes, setNotes] = useState('');

  const addressStr = useMemo(() => formatAddress(profile?.address), [profile]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Become a {type}</h1>
          <p className="text-muted-foreground mt-2">
            Review your profile details and add any additional notes before submitting.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <Input value={profile?.full_name || ''} readOnly className="bg-muted/50" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input type="email" value={profile?.email || ''} readOnly className="bg-muted/50" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <Input value={profile?.phone_number || ''} readOnly className="bg-muted/50" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <Textarea value={addressStr} readOnly className="bg-muted/50 min-h-[80px]" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <Textarea
              placeholder={`Tell us why you want to become a ${type}...`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onSubmit(notes)} disabled={submitting || pending}>
            {submitting ? 'Submitting…' : pending ? 'Pending' : 'Submit Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
