import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/utils/logger';
import { Database } from '@/types/supabase';

export async function POST(request: Request) {
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

    const { requestId, action, role } = await request.json();

    if (!requestId || !action || !role) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // The RPC function `handle_role_request` already checks for admin role.
    const { data, error } = await supabase.rpc('handle_role_request', {
      p_request_id: requestId,
      p_action: action,
      p_role: role,
    });

    if (error) {
      logger.error('Error handling role request:', { error });
      throw error;
    }

    if (data.status === 'error') {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: data.message });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObject = error instanceof Error ? error : new Error('Unknown error');
    
    logger.error('API error handling role request:', { error: errorObject });
    return NextResponse.json(
      { error: 'Internal Server Error', details: errorMessage },
      { status: 500 }
    );
  }
}
