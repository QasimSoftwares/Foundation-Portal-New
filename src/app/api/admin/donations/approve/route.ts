import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger, logAuthEvent } from '@/services/auditService';
import { generateReceiptPDF } from '@/lib/receipts/generateReceipt';

export const runtime = 'nodejs';

// POST /api/admin/donations/approve
// Body: { donation_request_id: string }
// Flow:
// 1) Verify session and admin role
// 2) Call RPC public.approve_donation_request -> get donation row
// 3) Generate placeholder PDF for donation_id
// 4) Upload to Supabase Storage at receipts/donations/{donation_id}.pdf
// 5) Update donations.receipt_pdf_path with the storage path
// 6) Return donation info
export async function POST(request: NextRequest) {
  const reqId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const startedAt = Date.now();

  try {
    // Create a simple Supabase client for server-side operations
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => {
            const cookie = cookieStore.get(name);
            return cookie?.value;
          },
          set: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
      }
    );

    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2) Role check via RPC public.my_roles()
    const { data: roles, error: rolesErr } = await supabase.rpc('my_roles');
    if (rolesErr) {
      logger.error('Failed to fetch roles via my_roles()', { reqId, userId, error: rolesErr.message });
      return NextResponse.json({ error: 'Role fetch failed' }, { status: 500 });
    }

    if (!roles?.is_admin) {
      logger.warn('Donation approval denied: not admin', { reqId, userId });
      await logAuthEvent('donation_approve_denied_not_admin', { userId, reqId });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const donation_request_id: string | undefined = body?.donation_request_id;
    if (!donation_request_id) {
      return NextResponse.json({ error: 'donation_request_id is required' }, { status: 400 });
    }

    // 3) Approve via RPC
    const { data: donation, error: approveErr } = await supabase
      .rpc('approve_donation_request', { p_donation_request_id: donation_request_id });

    if (approveErr || !donation) {
      logger.error('approve_donation_request RPC failed', { reqId, userId, donation_request_id, error: approveErr?.message });
      await logAuthEvent('donation_approve_failed', { userId, reqId, donation_request_id, error: approveErr?.message ?? 'unknown' });
      return NextResponse.json({ status: 'error', message: 'Approval failed' }, { status: 400 });
    }

    const donation_id: string = donation.donation_id;

    // 3b) Fetch additional details to render on the receipt
    // Donor and profile (for name/contact/address)
    const { data: donorRow, error: donorErr } = await supabase
      .from('donors')
      .select('donor_id, donor_number, user_id')
      .eq('donor_id', donation.donor_id)
      .single();
    if (donorErr) {
      logger.warn('Failed to fetch donor row for receipt', { reqId, userId, donation_id, error: donorErr.message });
    }
    console.log('Donor row from DB:', JSON.stringify(donorRow, null, 2));

    const { data: donorProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('full_name, phone_number, address')
      .eq('user_id', donorRow?.user_id ?? '')
      .maybeSingle();
    console.log('Donor profile from DB:', JSON.stringify(donorProfile, null, 2));
    if (profileErr) {
      logger.warn('Failed to fetch donor profile for receipt', { reqId, userId, donation_id, error: profileErr.message });
    } else if (!donorProfile) {
      logger.warn('No profile found for donor', { 
        reqId, 
        userId, 
        donorId: donation.donor_id, 
        profileUserId: donorRow?.user_id 
      });
    }

    // Category and project names
    const { data: categoryRow } = await supabase
      .from('donation_categories')
      .select('donation_category_name')
      .eq('donation_category_id', donation.category_id as any)
      .maybeSingle();

    const { data: projectRow } = await supabase
      .from('projects')
      .select('project_name')
      .eq('project_id', donation.project_id)
      .maybeSingle();

    // Approver profile (name/email)
    const { data: approverProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', donation.approved_by)
      .maybeSingle();

    // Build address string
    const addr = (donorProfile as any)?.address || {};
    console.log('Raw address JSON from DB:', JSON.stringify(addr, null, 2));
    
    // Extract all possible address parts
    const street = addr.street || addr.address || addr.address_line1 || '';
    const city = addr.city || addr.town || addr.locality || '';
    const state = addr.state || addr.province || addr.region || '';
    const postal = addr.postal_code || addr.postal || addr.zip || '';
    const country = addr.country || '';
    
    // Compose as single line: "street, city state postal, country"
    const cityStatePostal = [city, state, postal].filter(Boolean).join(' ').trim();
    const addressParts = [street, cityStatePostal, country].filter(p => !!p && String(p).trim().length > 0) as string[];
    const addressStr = addressParts.join(', ');
    
    console.log('Computed address string:', addressStr);

    // 4) Generate receipt PDF using shared template with real values
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateReceiptPDF({
        donation_id,
        donor_id: donation.donor_human_id ?? donorRow?.donor_number,
        donor_name: donorProfile?.full_name || undefined,
        phone_number: donorProfile?.phone_number || undefined,
        address: addressStr || undefined,
        amount: donation.amount,
        currency: donation.currency,
        donation_date: donation.donation_date,
        payment_method: donation.mode_of_payment,
        transaction_id: donation.transaction_id ?? undefined,
        category_name: categoryRow?.donation_category_name ?? undefined,
        project_name: projectRow?.project_name ?? undefined,
        donation_type: donation.donation_type,
        approved_by_name: approverProfile?.full_name || undefined,
      });
      
      logger.info('PDF receipt generated successfully', { reqId, userId, donation_id, pdfSize: pdfBytes.length });
    } catch (pdfError) {
      const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error generating PDF';
      logger.error('Failed to generate receipt PDF', { reqId, userId, donation_id, error: errorMessage });
      await logAuthEvent('donation_receipt_generation_failed', { 
        userId, 
        reqId, 
        donation_id, 
        error: errorMessage 
      });
      // Rollback approval since we cannot proceed without a receipt
      try {
        await supabase.rpc('rollback_approved_donation', { p_donation_id: donation_id });
        logger.info('Rolled back donation after PDF generation failure', { reqId, donation_id });
      } catch (rbErr: any) {
        logger.error('Rollback after PDF generation failure failed', { reqId, donation_id, error: rbErr?.message });
      }
      return NextResponse.json({ status: 'error', message: 'Failed to generate receipt' }, { status: 500 });
    }

    // 5) Upload to Storage directly (admins allowed by RLS policies)
    try {
      // Log admin status just before upload (helps diagnose RLS issues)
      const { data: roleProbe } = await supabase.rpc('my_roles');
      logger.info('Starting receipt upload to storage', { reqId, userId, donation_id, is_admin: roleProbe?.is_admin });

      const storagePath = `donations/${donation_id}.pdf`;

      // Prefer Blob for Node >= 18 to avoid binary payload issues
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      // Update donations.receipt_pdf_path with full storage path
      const fullPath = `receipts/${storagePath}`;
      const { error: updateErr } = await supabase
        .from('donations')
        .update({ receipt_pdf_path: fullPath })
        .eq('donation_id', donation_id);

      if (updateErr) {
        // Cleanup uploaded file, then rollback approval
        try {
          await supabase.storage.from('receipts').remove([storagePath]);
          logger.info('Removed uploaded receipt after DB update failure', { reqId, donation_id, storagePath });
        } catch (rmErr: any) {
          logger.error('Failed to remove uploaded receipt after DB update failure', { reqId, donation_id, error: rmErr?.message });
        }
        throw updateErr;
      }

      logger.info('Receipt uploaded and donation updated', { reqId, userId, donation_id, storagePath: fullPath });
    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
      logger.error('Receipt upload failed', { 
        reqId, 
        userId, 
        donation_id, 
        error: errorMessage,
        errorDetails: JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError))
      });
      
      await logAuthEvent('donation_receipt_upload_failed', { 
        userId, 
        reqId, 
        donation_id, 
        error: errorMessage 
      });
      // Rollback the approval since upload/DB update failed
      try {
        await supabase.rpc('rollback_approved_donation', { p_donation_id: donation_id });
        logger.info('Rolled back donation after upload/update failure', { reqId, donation_id });
      } catch (rbErr: any) {
        logger.error('Rollback after upload/update failure failed', { reqId, donation_id, error: rbErr?.message });
      }
      return NextResponse.json({ status: 'error', message: 'Receipt upload failed' }, { status: 500 });
    }

    // 6) Get the updated donation record with receipt path
    let donationData;
    try {
      const { data, error: fetchErr } = await supabase
        .from('donations')
        .select('*')
        .eq('donation_id', donation_id)
        .single();

      if (fetchErr) throw fetchErr;
      if (!data) throw new Error('Donation record not found after update');
      
      donationData = data;
      
      logger.info('Successfully retrieved updated donation record', { 
        reqId, 
        userId, 
        donation_id, 
        hasReceiptPath: !!data.receipt_pdf_path 
      });
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error fetching donation record';
      logger.error('Failed to fetch updated donation record', { 
        reqId, 
        userId, 
        donation_id, 
        error: errorMessage 
      });
      
      await logAuthEvent('donation_receipt_verify_failed', { 
        userId, 
        reqId, 
        donation_id, 
        error: errorMessage 
      });
      
      // Rollback since we cannot verify the updated donation record
      try {
        await supabase.rpc('rollback_approved_donation', { p_donation_id: donation_id });
        logger.info('Rolled back donation after verification failure', { reqId, donation_id });
      } catch (rbErr: any) {
        logger.error('Rollback after verification failure failed', { reqId, donation_id, error: rbErr?.message });
      }
      return NextResponse.json({ status: 'error', message: 'Failed to verify receipt upload' }, { status: 500 });
    }

    const fullStoragePath = donationData.receipt_pdf_path as string | null;
    
    if (!fullStoragePath) {
      logger.error('Receipt path not found after upload', { reqId, userId, donation_id });
      await logAuthEvent('donation_receipt_path_missing', { userId, reqId, donation_id });
      return NextResponse.json({ error: 'Receipt path not found after upload' }, { status: 500 });
    }

    await logAuthEvent('donation_receipt_uploaded', { userId, reqId, donation_id, storagePath: fullStoragePath });

    const durationMs = Date.now() - startedAt;
    logger.info('Donation approved and receipt uploaded', { reqId, userId, donation_id, storagePath: fullStoragePath, durationMs });

    return NextResponse.json({ status: 'success', donationId: donation_id, receiptPath: fullStoragePath }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Unhandled error in donation approval route', { error: message });
    return NextResponse.json({ status: 'error', message: 'Internal server error' }, { status: 500 });
  }
}
