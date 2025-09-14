import { createServerClient } from '@supabase/ssr';
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
      // Prepare response (for any cookie writes by Supabase client)
      const response = new NextResponse();
      const cookieStore = await cookies();

      // Create Supabase client with proper cookie handling (including base64 decoding)
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              const cookie = cookieStore.get(name)?.value;
              if (cookie && cookie.startsWith('base64-')) {
                try {
                  return Buffer.from(cookie.slice(7), 'base64').toString('utf-8');
                } catch {
                  return cookie;
                }
              }
              return cookie;
            },
            set(name: string, value: string, options: any) {
              response.cookies.set({ name, value, ...options });
            },
            remove(name: string, options: any) {
              response.cookies.set({ name, value: '', ...options, maxAge: 0 });
            },
          },
        }
      );
      
      // Verify user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: { ...response.headers, 'Content-Type': 'application/json' } }
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
          { status: 400, headers: response.headers }
        );
      }

      // Update user profile via RPC (no direct table writes)
      const addressJson = body.address ? { raw: body.address } : null;
      const { data: profileUpdate, error: profileError } = await supabase
        .rpc('update_profile', {
          p_full_name: body.fullName,
          p_phone_number: body.phone,
          p_address: addressJson
        });

      if (profileError || (profileUpdate && profileUpdate.success === false)) {
        const errMsg = profileError?.message || profileUpdate?.message || 'Failed to update profile information';
        logger.error(`[DonorRequest] Failed to update profile for user=${session.user.id}: ${errMsg}`);
        return NextResponse.json({ error: 'Failed to update profile information' }, { status: 500, headers: response.headers });
      }

      // Create donor request using RPC
      const { data: requestId, error: requestError } = await supabase.rpc('create_donor_request');
      
      if (requestError) {
        const message = requestError.message.includes('already have a pending')
          ? 'You already have a pending donor request'
          : 'Failed to create donor request';
        logger.warn(`[DonorRequest] Create request failed user=${session.user.id}: ${requestError.message}`, {
          error: requestError,
          userId: session.user.id
        });
        return NextResponse.json({ error: message }, { status: 400, headers: response.headers });
      }
      
      // Ensure we have the request ID
      if (!requestId) {
        throw new Error('Failed to create donor request: No request ID returned');
      }

      // Log the event
      logger.info(`[DonorRequest] Created request id=${requestId} user=${session.user.id}`);

      return NextResponse.json({ 
        success: true, 
        requestId: requestId
      }, { status: 200, headers: response.headers });

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
