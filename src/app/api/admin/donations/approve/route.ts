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

    // 3b) Fetch all receipt details using the dedicated RPC
    const { data: detailsData, error: detailsErr } = await supabase
      .rpc('get_donation_receipt_details', { p_donation_id: donation_id });

    if (detailsErr) {
      logger.error('Failed to fetch receipt details via RPC', { reqId, userId, donation_id, error: detailsErr?.message });
      try {
        await supabase.rpc('rollback_approved_donation', { p_donation_id: donation_id });
        logger.info('Rolled back donation after receipt details fetch failure', { reqId, donation_id });
      } catch (rbErr: any) {
        logger.error('Rollback after receipt details fetch failure failed', { reqId, donation_id, error: rbErr?.message });
      }
      return NextResponse.json({ status: 'error', message: 'Failed to fetch receipt details' }, { status: 500 });
    }

    if (!detailsData || detailsData.length === 0) {
      logger.error('No receipt details found for donation', { reqId, userId, donation_id });
      try {
        await supabase.rpc('rollback_approved_donation', { p_donation_id: donation_id });
        logger.info('Rolled back donation after receipt details were not found', { reqId, donation_id });
      } catch (rbErr: any) {
        logger.error('Rollback after receipt details were not found failed', { reqId, donation_id, error: rbErr?.message });
      }
      return NextResponse.json({ status: 'error', message: 'Receipt details not found' }, { status: 500 });
    }

    const receiptDetails = detailsData[0];
    logger.info('Receipt details fetched', { 
      reqId, 
      donation_id: receiptDetails.donation_id,
      hasDonorName: !!receiptDetails.donor_name,
      hasPhone: !!receiptDetails.phone_number,
      hasAddress: !!receiptDetails.address
    });

    // 4) Generate receipt PDF using shared template with real values
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateReceiptPDF({
        donation_id: receiptDetails.donation_id,
        donor_id: receiptDetails.donor_human_id,
        donor_name: receiptDetails.donor_name || 'N/A',
        phone_number: receiptDetails.phone_number || 'N/A',
        address: receiptDetails.address || 'N/A',
        amount: receiptDetails.amount,
        currency: receiptDetails.currency,
        donation_date: receiptDetails.donation_date,
        payment_method: receiptDetails.payment_method,
        transaction_id: receiptDetails.transaction_id ?? undefined,
        category_name: receiptDetails.category_name ?? undefined,
        project_name: receiptDetails.project_name ?? undefined,
        donation_type: receiptDetails.donation_type,
        approved_by_name: receiptDetails.approved_by_name || undefined,
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
    const storagePath = `donations/${donation_id}.pdf`;
    
    try {
      // Log admin status just before upload (helps diagnose RLS issues)
      const { data: roleProbe } = await supabase.rpc('my_roles');
      logger.info('Starting receipt upload to storage', { 
        reqId, 
        userId, 
        donation_id, 
        is_admin: roleProbe?.is_admin,
        storagePath
      });

      // Prefer Blob for Node >= 18 to avoid binary payload issues
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });

      // First, try to remove any existing file to avoid conflicts
      try {
        await supabase.storage.from('receipts').remove([storagePath]);
      } catch (removeErr: unknown) {
        // Ignore if file doesn't exist
        const errorMessage = removeErr instanceof Error ? removeErr.message : String(removeErr);
        logger.info('No existing file to remove or remove failed', { reqId, storagePath, error: errorMessage });
      }

      // Upload the new file
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadErr) throw uploadErr;

      // Update donations.receipt_pdf_path with just the storage path (without 'receipts/' prefix)
      const { error: updateErr } = await supabase.rpc('update_donation_receipt_path', {
        p_donation_id: donation_id,
        p_receipt_path: storagePath  // Just the path within the bucket, not the full path
      });

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

      logger.info('Receipt uploaded and donation updated', { reqId, userId, donation_id, storagePath });
    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
      logger.error('Receipt upload failed', { 
        reqId, 
        userId, 
        donation_id, 
        error: errorMessage,
        errorDetails: JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError)),
        storagePath: storagePath
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
      // First try to get the record directly by ID
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
        error: errorMessage,
        // Add more details for debugging
        errorDetails: JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError))
      });
      
      await logAuthEvent('donation_receipt_verify_failed', { 
        userId, 
        reqId, 
        donation_id, 
        error: errorMessage 
      });
      
      // Don't rollback here since the update was successful
      // Just return the donation ID without the full record
      return NextResponse.json({ 
        status: 'success', 
        donationId: donation_id, 
        receiptPath: storagePath,
        warning: 'Donation approved but could not verify update'
      }, { status: 200 });
    }

    const fullStoragePath = donationData.receipt_pdf_path as string | null;
    
    if (!fullStoragePath) {
      logger.error('Receipt path not found after upload', { 
        reqId, 
        userId, 
        donation_id,
        donationData // Log the full record for debugging
      });
      await logAuthEvent('donation_receipt_path_missing', { 
        userId, 
        reqId, 
        donation_id 
      });
      // Still return success since the donation was approved
      return NextResponse.json({ 
        status: 'success', 
        donationId: donation_id, 
        warning: 'Receipt path not found in response but donation was approved'
      }, { status: 200 });
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
