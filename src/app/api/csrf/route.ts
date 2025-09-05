import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Get the existing CSRF token from cookies
    const cookieStore = await cookies();
    const csrfToken = cookieStore.get('sb-csrf-token')?.value;
    
    if (!csrfToken) {
      return NextResponse.json(
        { error: 'No CSRF token found' },
        { status: 401 }
      );
    }

    return NextResponse.json({ 
      csrfToken,
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiration
    });

  } catch (error) {
    console.error('CSRF token error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve CSRF token' },
      { status: 500 }
    );
  }
}
