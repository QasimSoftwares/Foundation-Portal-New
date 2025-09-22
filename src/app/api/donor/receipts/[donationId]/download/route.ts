// src/app/api/donor/receipts/[donationId]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest, context: { params: Promise<{ donationId: string }> }) {
  const { donationId } = await context.params;
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  // Verify the donation belongs to the current user and get the receipt path
  const { data: pathData, error: pathError } = await supabase.rpc('get_receipt_path_if_owner', { p_donation_id: donationId });
  if (pathError) {
    return NextResponse.json({ error: 'Failed to verify receipt path', details: pathError.message }, { status: 500 });
  }
  if (!pathData) {
    return NextResponse.json({ error: 'Forbidden or receipt not available' }, { status: 403 });
  }

  const storagePath = pathData as string; // e.g., donations/<id>.pdf

  // Download the file through Storage with current user's auth context
  const { data: fileData, error: dlError } = await supabase.storage.from('receipts').download(storagePath);
  if (dlError || !fileData) {
    return NextResponse.json({ error: 'Failed to download receipt', details: dlError?.message }, { status: 404 });
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${donationId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
