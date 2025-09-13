import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// Define request schema
const requestSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  message: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
      const cookieStore = cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      
      // Verify user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Parse and validate request body
      const body = await request.json();
      const validation = requestSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { 
            error: 'Validation failed',
            details: validation.error.format() 
          },
          { status: 400 }
        );
      }

      // Update user profile with the provided information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: body.fullName,
          phone: body.phone,
          address: body.address,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id)
        .select()
        .single();

      if (profileError) {
        logger.error(`[DonorRequest] Failed to update profile for user=${session.user.id}: ${profileError.message}`);
        return NextResponse.json({ error: 'Failed to update profile information' }, { status: 500 });
      }

      // Create donor request using RPC
      const { data: requestData, error: requestError } = await supabase.rpc('create_donor_request');
      
      if (requestError) {
        const message = requestError.message.includes('already have a pending')
          ? 'You already have a pending donor request'
          : 'Failed to create donor request';
        logger.warn(`[DonorRequest] Create request failed user=${session.user.id}: ${message}`);
        return NextResponse.json({ error: message }, { status: 400 });
      }
      
      // Ensure we have the request ID
      if (!requestData) {
        throw new Error('Failed to create donor request: No data returned');
      }


      // Log the event
      logger.info(`[DonorRequest] Created request id=${requestData} user=${session.user.id}`);

      return NextResponse.json({ 
        success: true, 
        requestId: requestData
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      logger.error(`[DonorRequest] Error: ${message}`);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

// Add OPTIONS handler for CORS preflight
export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
