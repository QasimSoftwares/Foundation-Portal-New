import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          cookieStore.set(name, value, { ...options, path: '/' });
        },
        remove: (name: string, options: any) => {
          cookieStore.set(name, '', { ...options, maxAge: 0, path: '/' });
        },
      },
    }
  );

  try {
    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the request exists
    const { data: request, error: requestError } = await supabase
      .from('role_requests')
      .select('*')
      .eq('request_id', '85cc37d8-e804-4858-a6b4-1fcab35056d0')
      .single();

    if (requestError || !request) {
      return NextResponse.json({
        error: 'Request not found',
        details: requestError
      }, { status: 404 });
    }

    // Check if the user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', request.user_id)
      .single();

    // Check RPC function
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_pending_role_requests');
      
    const rpcResult = rpcData?.find((req: any) => 
      req.request_id === '85cc37d8-e804-4858-a6b4-1fcab35056d0'
    );

    return NextResponse.json({
      request,
      profile: profile || { error: 'Profile not found', details: profileError },
      rpcResult: rpcResult || { error: 'RPC did not return request', details: rpcError }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
