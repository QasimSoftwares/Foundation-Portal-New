import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';

export interface ReceiptInput {
  donation_id: string;
  donor_id?: string;
  donor_name?: string;
  phone_number?: string;
  address?: string;
  amount?: number | string;
  currency?: string;
  donation_date?: string; // YYYY-MM-DD or ISO
  receipt_number?: string;
  payment_method?: string;
  transaction_id?: string;
  category_name?: string;
  project_name?: string;
  donation_type?: string;
  approved_by_name?: string;
  approved_by_email?: string;
}

export async function generateReceiptPDF(body: ReceiptInput): Promise<Uint8Array> {
  // Create a new PDF document in landscape mode (A4)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 419.53]); // A4 landscape dimensions in points (1 inch = 72 points)
  
  // Set up fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  
  // Add dimmed logo to background
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      const logoImage = await pdfDoc.embedPng(logoBytes);
      
      const logoWidth = 300;
      const logoHeight = 300;
      const centerX = (page.getWidth() - logoWidth) / 2;
      const centerY = (page.getHeight() - logoHeight) / 2;
      page.drawImage(logoImage, {
        x: centerX,
        y: centerY,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.1,
      });
    }
  } catch (error) {
    // Continue without the logo if there's an error
    console.error('Error loading logo for receipt:', error);
  }
  
  // Set up colors
  const primaryColor = rgb(0.2, 0.4, 0.6);
  const textColor = rgb(0.2, 0.2, 0.2);
  const borderColor = rgb(0.8, 0.8, 0.8);
  
  // Organization header
  const foundationText = 'FAMILY AND FELLOWS FOUNDATION';
  const foundationTextWidth = fontBold.widthOfTextAtSize(foundationText, 18);
  page.drawText(foundationText, {
    x: (page.getWidth() - foundationTextWidth) / 2,
    y: page.getHeight() - 50,
    size: 18,
    font: fontBold,
    color: primaryColor,
  });
  
  // Title
  const receiptTitle = 'DONATION RECEIPT';
  page.drawText(receiptTitle, {
    x: 50,
    y: page.getHeight() - 90,
    size: 20,
    font: fontBold,
    color: primaryColor,
  });
  
  // Date
  const formattedDate = body.donation_date
    ? new Date(body.donation_date).toLocaleDateString()
    : new Date().toLocaleDateString();
  page.drawText(`Date: ${formattedDate}`, {
    x: 50,
    y: page.getHeight() - 110,
    size: 10,
    font: font,
    color: textColor,
  });
  
  // Donation ID right aligned
  const idText = `Donation ID: ${body.donation_id || 'N/A'}`;
  const idTextWidth = font.widthOfTextAtSize(idText, 10);
  page.drawText(idText, {
    x: page.getWidth() - 50 - idTextWidth,
    y: page.getHeight() - 90,
    size: 10,
    font: font,
    color: textColor,
  });
  
  // Donor ID below
  const donorIdText = `Donor ID: ${body.donor_id || 'N/A'}`;
  const donorIdWidth = font.widthOfTextAtSize(donorIdText, 10);
  page.drawText(donorIdText, {
    x: page.getWidth() - 50 - donorIdWidth,
    y: page.getHeight() - 105,
    size: 10,
    font: font,
    color: textColor,
  });
  
  // Donor details block
  const donorInfoY = page.getHeight() - 160;
  const rowHeight = 30;
  // Bordered area
  const borderX = 40;
  const borderY = donorInfoY + 15;
  const borderWidth = page.getWidth() - 80;
  const borderHeight = (rowHeight * 6) + 10; // extra row reserved for Approved By only
  page.drawRectangle({
    x: borderX,
    y: borderY - borderHeight,
    width: borderWidth,
    height: borderHeight,
    borderColor: primaryColor,
    borderWidth: 1.5,
    opacity: 0.3,
  });
  // Corner circles
  const cornerRadius = 6;
  const positions = [
    { x: borderX + cornerRadius, y: borderY - cornerRadius },
    { x: borderX + borderWidth - cornerRadius, y: borderY - cornerRadius },
    { x: borderX + cornerRadius, y: borderY - borderHeight + cornerRadius },
    { x: borderX + borderWidth - cornerRadius, y: borderY - borderHeight + cornerRadius },
  ];
  positions.forEach(pos => {
    page.drawCircle({
      x: pos.x,
      y: pos.y,
      size: cornerRadius * 2,
      color: rgb(1, 1, 1),
      opacity: 0.3,
    });
  });
  const col1X = 50;
  const col2X = 150;
  const col3X = 300;
  const col4X = 400;

  // Row 1: Name / Phone
  page.drawText('Name:', { x: col1X, y: donorInfoY, size: 10, font: fontBold, color: textColor });
  page.drawText(body.donor_name || 'N/A', { x: col2X, y: donorInfoY, size: 10, font, color: textColor });
  page.drawText('Phone:', { x: col3X, y: donorInfoY, size: 10, font: fontBold, color: textColor });
  page.drawText(body.phone_number || 'N/A', { x: col4X, y: donorInfoY, size: 10, font, color: textColor });

  // Row 2: Address
  const formattedAddress = String(body.address || '').replace(/\n/g, ', ');
  page.drawText('Address:', { x: col1X, y: donorInfoY - rowHeight, size: 10, font: fontBold, color: textColor });
  page.drawText(formattedAddress || 'N/A', { x: col2X, y: donorInfoY - rowHeight, size: 10, font, color: textColor });

  // Row 3: Category / Project
  page.drawText('Category:', { x: col1X, y: donorInfoY - (rowHeight * 2), size: 10, font: fontBold, color: textColor });
  page.drawText(body.category_name || 'N/A', { x: col2X, y: donorInfoY - (rowHeight * 2), size: 10, font, color: textColor });
  page.drawText('Project:', { x: col3X, y: donorInfoY - (rowHeight * 2), size: 10, font: fontBold, color: textColor });
  page.drawText(body.project_name || 'N/A', { x: col4X, y: donorInfoY - (rowHeight * 2), size: 10, font, color: textColor });

  // Row 4: Payment method / Transaction
  page.drawText('Mode of Payment:', { x: col1X, y: donorInfoY - (rowHeight * 3), size: 10, font: fontBold, color: textColor });
  page.drawText(body.payment_method || 'Online', { x: col2X, y: donorInfoY - (rowHeight * 3), size: 10, font, color: textColor });
  page.drawText('Transaction ID:', { x: col3X, y: donorInfoY - (rowHeight * 3), size: 10, font: fontBold, color: textColor });
  page.drawText(body.transaction_id || 'N/A', { x: col4X, y: donorInfoY - (rowHeight * 3), size: 10, font, color: textColor });

  // Row 5: Donation type / Amount
  const amount = parseFloat(String(body.amount ?? '0'));
  const amountText = `${body.currency || 'PKR'} ${amount.toFixed(2)}`;
  page.drawText('Donation Type:', { x: col1X, y: donorInfoY - (rowHeight * 4), size: 10, font: fontBold, color: textColor });
  page.drawText(body.donation_type || 'One-time', { x: col2X, y: donorInfoY - (rowHeight * 4), size: 10, font, color: textColor });
  page.drawText('Amount:', { x: col3X, y: donorInfoY - (rowHeight * 4), size: 10, font: fontBold, color: textColor });
  page.drawText(amountText, { x: col4X, y: donorInfoY - (rowHeight * 4), size: 10, font: fontBold, color: primaryColor });

  // Row 6: Approved By (no Receipt #)
  page.drawText('Approved By:', { x: col1X, y: donorInfoY - (rowHeight * 5), size: 10, font: fontBold, color: textColor });
  page.drawText(body.approved_by_name || 'N/A', { x: col2X, y: donorInfoY - (rowHeight * 5), size: 10, font, color: textColor });

  // Footer
  const footerY = 20;
  page.drawLine({ start: { x: 50, y: footerY + 30 }, end: { x: 545, y: footerY + 30 }, thickness: 1, color: borderColor });
  const footerText = 'Together We Can Make a Difference';
  const footerTextWidth = fontItalic.widthOfTextAtSize(footerText, 12);
  page.drawText(footerText, { x: (page.getWidth() - footerTextWidth) / 2, y: footerY, size: 12, font: fontItalic || font, color: primaryColor });

  // QR code
  const qrCodeData = {
    donationId: body.donation_id,
    donorId: body.donor_id,
    type: body.donation_type || 'General Donation',
    amount: amountText,
    date: new Date().toISOString().split('T')[0],
  };
  const qrCodeText = JSON.stringify(qrCodeData, null, 2);
  const qrCodeDataUrl = await QRCode.toDataURL(qrCodeText, { width: 300, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } });
  const qrCodeBase64 = qrCodeDataUrl.split(',')[1];
  const qrCodeBytes = Uint8Array.from(atob(qrCodeBase64), c => c.charCodeAt(0));
  const qrCodeImage = await pdfDoc.embedPng(qrCodeBytes);
  const qrSize = 60;
  const qrX = page.getWidth() - qrSize - 40;
  const qrY = 100;
  page.drawImage(qrCodeImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawText('Scan to Verify', { x: qrX - 10, y: qrY - 15, size: 8, color: rgb(0.4, 0.4, 0.4) });

  // Serialize
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
