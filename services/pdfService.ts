const PDFDocument = require('pdfkit');
import fs from 'fs';
import path from 'path';

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

      // --- Header ---
      doc.fontSize(20).text(process.env.COMPANY_NAME || 'Your Company Ltd', { align: 'center' });
      doc.fontSize(10).text(process.env.COMPANY_ADDRESS || '123 Business Street, City, Country', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('SALARY SLIP', { align: 'center', underline: true });
      doc.moveDown();

      // --- Employee Info ---
      doc.fontSize(12).text(`Employee Name: ${slip.employee?.name || 'N/A'}`);
      doc.text(`Employee ID: ${slip.employee?.employeeId || 'N/A'}`);
      doc.text(`Department: ${slip.employee?.department || 'N/A'}`);
      doc.text(`Position: ${slip.employee?.position || 'N/A'}`);
      doc.text(`Period: ${slip.period?.month || '-'}/${slip.period?.year || '-'}`);
      doc.moveDown();

      // --- Earnings Table ---
      doc.fontSize(14).text('Earnings', { underline: true });
      doc.fontSize(11);
      const earnings = slip.earnings || {};
      doc.text(`Basic Salary: LKR ${(earnings.basicSalary || 0).toLocaleString()}`);
      doc.text(`Allowances: LKR ${(earnings.allowances || 0).toLocaleString()}`);
      doc.text(`Bonus: LKR ${(earnings.bonus || 0).toLocaleString()}`);
      doc.text(`Overtime: LKR ${(earnings.overtime || 0).toLocaleString()}`);
      doc.moveDown();

      // --- Deductions Table ---
      doc.fontSize(14).text('Deductions', { underline: true });
      doc.fontSize(11);
      const deductions = slip.deductions || {};
      doc.text(`Tax: LKR ${(deductions.tax || 0).toLocaleString()}`);
      doc.text(`Insurance: LKR ${(deductions.insurance || 0).toLocaleString()}`);
      doc.text(`Other: LKR ${(deductions.other || 0).toLocaleString()}`);
      doc.moveDown();

      // --- Net Salary ---
      doc.fontSize(14).rect(50, doc.y, 400, 30).stroke();
      doc.text(`NET SALARY: LKR ${(slip.netSalary || 0).toLocaleString()}`, 60, doc.y + 10);
      doc.moveDown(2);

      // --- Signature ---
      if (options.includeSignature && slip.signatureData) {
        doc.fontSize(12).text('Employee Signature:', { underline: true });
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
      }

      // --- Footer ---
      doc.fontSize(8).text('Generated automatically by ERP System', 50, doc.page.height - 50, { align: 'center' });

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
