import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';
import { Database } from '@/types/supabase';
import { TransformedRequest } from '@/types/request';

type PendingRequest = Database["public"]["Functions"]["get_pending_role_requests"]["Returns"][number];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'donor', 'volunteer', 'member', or undefined for all
  
  const cookieStore = await cookies();
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => {
          return cookieStore.get(name)?.value;
        },
        set: (name: string, value: string, options: any) => {
          cookieStore.set(name, value, {
            ...options,
            path: '/',
          });
        },
        remove: (name: string, options: any) => {
          cookieStore.set(name, '', {
            ...options,
            maxAge: 0,
            path: '/',
          });
        },
      },
    }
  );

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Fetching pending role requests', { type });
    
    // Call the RPC function to get pending requests
    logger.info('Calling get_pending_role_requests RPC');
    const { data, error } = await supabase.rpc('get_pending_role_requests');
    
    logger.info('RPC response:', { 
      hasData: !!data, 
      dataLength: Array.isArray(data) ? data.length : 'not an array',
      error: error ? error.message : 'no error'
    });

    if (error) {
      const errorDetails = {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      };
      logger.error('Error fetching role requests:', errorDetails);
      return NextResponse.json({ error: 'Database RPC error', details: errorDetails }, { status: 500 });
    }
    
    const requests = data || [];
    const status = error ? 500 : 200;
    const statusText = error ? 'RPC Error' : 'OK';
      
    // Filter by type if specified
    logger.info('Filtering requests', { type, requestCount: requests.length });
    logger.debug('All requests:', requests);
    
    interface RequestItem {
      request_id: string;
      user_id: string;
      request_type: string;
      status: 'pending' | 'approved' | 'rejected';
      created_at: string;
      updated_at: string;
      full_name: string;
      email: string;
      notes?: string | null;
    }

    const filteredRequests: RequestItem[] = type 
      ? requests.filter((req: RequestItem) => {
          const matches = req.request_type === type;
          logger.debug(`Request ${req.request_id} type: ${req.request_type}, matches ${type}: ${matches}`);
          return matches;
        })
      : requests;
      
    logger.info('Filtered requests:', { 
      type, 
      count: filteredRequests.length,
      requestIds: filteredRequests.map((r: RequestItem) => r.request_id)
    });
      
    if (error) {
      const errorDetails = {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
        status,
        statusText
      };
      
      logger.error('Error fetching role requests:', errorDetails);
      return NextResponse.json(
        { 
          error: 'Database error',
          details: errorDetails 
        }, 
        { status: 500 }
      );
    }
    
    // Profiles are already joined in the RPC, so we can skip the separate profiles fetch
    
    if (error) {
      const errorDetails = {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
        status,
        statusText
      };
      
      logger.error('Error fetching pending requests:', errorDetails);
      return NextResponse.json(
        { 
          error: 'Database error',
          details: errorDetails 
        }, 
        { status: 500 }
      );
    }
    
    logger.info('Fetched requests count:', { count: requests?.length });

    // Transform the RPC response to match the TransformedRequest type
    const transformedRequests: TransformedRequest[] = filteredRequests.map((req: PendingRequest) => ({
      id: req.request_id,
      user_id: req.user_id,
      full_name: req.full_name || 'Unknown',
      email: req.email || 'No email',
      status: req.status as 'pending' | 'approved' | 'rejected',
      created_at: req.created_at,
      updated_at: req.created_at, // The RPC doesn't return updated_at, so we use created_at
      notes: null, // The RPC doesn't return notes
      request_type: req.request_type,
    }));

    return NextResponse.json(transformedRequests);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObject = error instanceof Error ? error : new Error('Unknown error');
    
    logger.error('API error fetching pending requests:', { error: errorObject });
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 }
    );
  }
}
