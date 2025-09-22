import { NextResponse } from 'next/server';
import { generateReceiptPDF } from '@/lib/receipts/generateReceipt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pdfBytes = await generateReceiptPDF(body);
    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="donation-receipt.pdf"',
      },
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to generate receipt' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
