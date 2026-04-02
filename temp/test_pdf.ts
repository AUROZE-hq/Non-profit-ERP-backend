import { generateSalarySlipPDF } from '../services/pdfService';
import { uploadToCloudinary } from '../services/cloudinaryService';
import dotenv from 'dotenv';
dotenv.config();

const testSlip = {
  _id: 'test-123',
  employee: { name: 'Hari', employeeId: '001', department: 'IT', position: 'Dev' },
  period: { month: 4, year: 2026 },
  earnings: { basicSalary: 1000 },
  deductions: { tax: 100 },
  netSalary: 900,
  signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  signedAt: new Date()
};

async function run() {
  console.log('Generating PDF...');
  try {
    const pdfPath = await generateSalarySlipPDF(testSlip, { includeSignature: true });
    console.log('Generated at:', pdfPath);
    console.log('Uploading to Cloudinary...');
    const result = await uploadToCloudinary(pdfPath, 'finance/salary_slip_test-123_signed.pdf');
    console.log('Uploaded! URL:', result.cloudinaryUrl);
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
