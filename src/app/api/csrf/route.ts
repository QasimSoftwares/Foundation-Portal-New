import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
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
    const message = error instanceof Error ? error.message : 'Failed to retrieve CSRF token';
    logger.error(`[CSRF] token retrieval error: ${message}`);
    return NextResponse.json({ error: 'Failed to retrieve CSRF token' }, { status: 500 });
  }
}
