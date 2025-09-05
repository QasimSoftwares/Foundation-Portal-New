import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Create a Supabase client configured to use cookies
    const supabase = createRouteHandlerClient({ cookies });
    
    // Sign out the user
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return NextResponse.json(
        { error: 'Error signing out' },
        { status: 500 }
      );
    }
    
    // Create a response
    const response = NextResponse.json({ message: 'Signed out successfully' });
    
    // Clear the auth cookie
    response.cookies.set({
      name: 'sb-auth-token',
      value: '',
      path: '/',
      expires: new Date(0)
    });
    
    return response;
    
  } catch (error) {
    console.error('Error in signout route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Prevent caching of the signout endpoint
export const dynamic = 'force-dynamic';
