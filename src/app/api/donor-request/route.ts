import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/rate-limit';
import { securityLogger } from '@/lib/security/security-logger';

// Define request schema
const requestSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  message: z.string().optional(),
});

export const POST = withRateLimit(
  async (request: NextRequest) => {
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
        console.error('Error updating profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to update profile information' },
          { status: 500 }
        );
      }

      // Create donor request using RPC
      const { data: requestData, error: requestError } = await supabase.rpc('create_donor_request');
      
      if (requestError) {
        console.error('Error creating donor request:', requestError);
        throw new Error(
          requestError.message.includes('already have a pending') 
            ? 'You already have a pending donor request' 
            : 'Failed to create donor request'
        );
      }
      
      // Ensure we have the request ID
      if (!requestData) {
        throw new Error('Failed to create donor request: No data returned');
      }


      // Log the security event
      await securityLogger.log({
        userId: session.user.id,
        action: 'donor_request_created',
        entityType: 'donor_request',
        entityId: requestData,
        metadata: {
          status: 'pending'
        },
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      });

      return NextResponse.json({ 
        success: true, 
        requestId: requestData
      });

    } catch (error) {
      console.error('Donor request error:', error);
      
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
  {
    // Rate limiting configuration
    maxRequests: 5, // 5 requests
    timeWindow: 60 * 60 * 1000, // per hour
    errorMessage: 'Too many requests. Please try again later.'
  }
);

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
