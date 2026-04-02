import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { generateSalarySlipPDF } from '../services/pdfService';
import { uploadToCloudinary } from '../services/cloudinaryService';

import { SalarySlip } from '../models/SignatureSchema';

async function testCloudinaryUpload() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to DB');

  try {
    const slip: any = await SalarySlip.findOne({ status: 'completed' });
    if (!slip) {
      console.log('No completed slips found.');
      return;
    }

    console.log(`Testing with slip ID: ${slip._id}`);

    // Generate PDF
    if (generateSalarySlipPDF) {
      console.log(`Generating PDF for slip ${slip._id}...`);
      const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: true });
      console.log(`PDF generated at: ${pdfPath}`);

      // Upload to Cloudinary
      if (uploadToCloudinary) {
        console.log(`Uploading PDF to Cloudinary...`);
        const destName = `finance/salary_slip_${slip.slipId || slip._id}_signed.pdf`;
        const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
        console.log(`Cloudinary upload success! URL: ${cloudinaryData.cloudinaryUrl}`);
        
        // Save to DB
        slip.pdfUrl = cloudinaryData.cloudinaryUrl;
        await slip.save();
        console.log('Saved to DB successfully.');
      } else {
        console.log('uploadToCloudinary function is null');
      }
    } else {
      console.log('generateSalarySlipPDF function is null');
    }
  } catch (error) {
    console.error('Test Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

testCloudinaryUpload();
