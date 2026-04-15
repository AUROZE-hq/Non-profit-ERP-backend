const PDFDocument = require('pdfkit');
import fs from 'fs';
import path from 'path';

function formatDollarAmount(value: number) {
  const amount = Number(value || 0);
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toLocaleString('en-CA', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatLongDate(value: Date) {
  return value.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function resolveLogoPath() {
  return path.join(__dirname, '..', 'public', 'logo.png');
}

function getAcknowledgementAmount(slip: any) {
  if (typeof slip?.honorariumAmount === 'number') {
    return slip.honorariumAmount;
  }
  if (typeof slip?.paymentAmount === 'number') {
    return slip.paymentAmount;
  }
  return Number(slip?.netSalary || 0);
}

function getAcknowledgementDate(slip: any) {
  const rawDate = slip?.paymentDate || slip?.paidAt || slip?.signedAt || slip?.sentAt || slip?.createdAt || new Date();
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * Generate a Salary Slip PDF
 * @param slip The salary slip document from Mongoose
 * @param options Options including whether to include the signature
 * @returns Path to the generated PDF file
 */
export async function generateSalarySlipPDF(slip: any, options: { includeSignature?: boolean } = {}) {
  return new Promise<string>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `salary_slip_${slip.slipId || slip._id}${options.includeSignature ? '_signed' : ''}.pdf`;
      const tempDir = path.join(__dirname, '..', 'temp');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filePath = path.join(tempDir, fileName);
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      const companyName = process.env.COMPANY_NAME || 'LOVECRY THE STREET KIDS ORGANIZATION';
      const companyAddress = process.env.COMPANY_ADDRESS || '702-150 Cosburn Avenue,Toronto, ON, M4J 2L9';
      const companyEmail = process.env.COMPANY_EMAIL || 'jwilson@lovecry.ca';
      const companyPhone = process.env.COMPANY_PHONE || '+1 647-938-6440';

      const participantName = String(slip?.employee?.name || '________________________');
      const amountText = formatDollarAmount(getAcknowledgementAmount(slip));
      const eventDate = getAcknowledgementDate(slip);
      const eventDateText = formatLongDate(eventDate);

      // --- Logo (centered, optional) ---
      const logoPath = resolveLogoPath();
      if (fs.existsSync(logoPath)) {
        const logoWidth = 90;
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoPath, logoX, doc.y, { width: logoWidth });
        doc.moveDown(4);
      }

      // --- Organization header ---
      doc.font('Helvetica-Bold').fontSize(14).text(companyName, { align: 'center' });
      doc.font('Helvetica').fontSize(10).text(companyAddress, { align: 'center' });
      doc.fontSize(10).text(companyEmail, { align: 'center' });
      doc.fontSize(10).text(companyPhone, { align: 'center' });
      doc.moveDown(2);

      // --- Title and subtitle ---
      doc.font('Helvetica-Bold').fontSize(18).text('LoveCry Wellness Series: Love is not a sin', { align: 'center' });
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(15).text('Acknowledgment of Honorarium Payment', { align: 'center' });
      doc.moveDown(2);

      // --- Acknowledgment paragraph ---
      const acknowledgementText = `I, ${participantName}, acknowledge that I have received an honorarium payment in the amount of ${amountText} on ${eventDateText} for my participation in the LoveCry Wellness Series. This honorarium reflects my contribution and involvement in the event, and I am grateful for the opportunity to participate.`;
      doc.font('Helvetica').fontSize(12).text(acknowledgementText, {
        align: 'left',
        lineGap: 4,
      });
      doc.moveDown(3);

      // --- Signature ---
      if (options.includeSignature && slip.signatureData) {
        doc.font('Helvetica').fontSize(12).text('Signature');
        doc.moveDown(0.4);

        // The signatureData is a base64 data URL: data:image/png;base64,xxxx
        const base64Data = slip.signatureData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Add image to PDF
        doc.image(buffer, {
          fit: [200, 100],
          align: 'left'
        });
        
        doc.moveDown();
        doc.text(`Signed At: ${slip.signedAt ? new Date(slip.signedAt).toLocaleString() : new Date().toLocaleString()}`);
      } else {
        doc.font('Helvetica').fontSize(12).text('Signature:');
        doc.moveDown(1.2);
        const lineY = doc.y;
        doc.moveTo(50, lineY).lineTo(280, lineY).stroke();
        doc.moveDown(1.2);
        doc.text('Date:');
      }

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}
