import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// allow safe require for optional JS services
const requireAny: any = require;

// Import PDF and Cloudinary services
let generateSalarySlipPDF: any = null;
try {
  generateSalarySlipPDF = require('../services/pdfService').generateSalarySlipPDF;
} catch (e: any) {
  console.warn('PDF Service not found or failed to load:', e.message);
}

let uploadToCloudinary: any = null;
try {
  uploadToCloudinary = require('../services/cloudinaryService').uploadToCloudinary;
} catch (e: any) {
  console.warn('Cloudinary Service not found or failed to load:', e.message);
}

let emailService: any = null;
try {
  emailService = require('../service/emailService');
} catch (e: any) {
  console.warn('Email Service not found or failed to load:', e.message);
}

// Import SalarySlip model (TypeScript model file exists)
import { SalarySlip } from '../models/SignatureSchema';

const router = express.Router();

// Create a salary slip and optionally send email
router.post('/', async (req: Request, res: Response) => {
  try {
    const body: any = req.body || {};
    const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const now = new Date();
    const slipData: any = {
      employee: body.employee || {},
      period: body.period || { month: 1, year: new Date().getFullYear() },
      earnings: body.earnings || {},
      deductions: body.deductions || {},
      netSalary: body.netSalary || 0,
      notes: body.notes || '',
      status: body.sendEmail ? 'pending_signature' : (body.status || 'draft'),
      deliveryChannel: channel,
      lastActivityAt: now,
      signatureToken: uuidv4(),
    };

    const slip = new SalarySlip(slipData);
    await slip.save();

    // generate PDF if pdf service available
    if (generateSalarySlipPDF) {
      try {
        console.log(`Generating draft PDF for slip ${slip._id}...`);
        const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: false });
        slip.pdfPath = pdfPath;
        console.log(`Draft PDF generated at: ${pdfPath}`);

        // upload to Cloudinary if available
        if (uploadToCloudinary) {
          console.log(`Uploading draft PDF to Cloudinary...`);
          const destName = `finance/salary_slip_${slip.slipId || slip._id}.pdf`;
          const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
          console.log(`Cloudinary draft upload success: ${cloudinaryData.cloudinaryUrl}`);
          
          slip.pdfUrl = cloudinaryData.cloudinaryUrl;
          slip.pdfPublicId = cloudinaryData.publicId;
          slip.pdfAssetId = cloudinaryData.assetId;
          slip.pdfFormat = cloudinaryData.format;
          slip.pdfFolder = cloudinaryData.folder;
          slip.pdfFileName = cloudinaryData.fileName;
          slip.storageProvider = 'cloudinary';
        } else {
          console.warn('Cloudinary service not available for draft.');
        }
        await slip.save();
      } catch (e: any) {
        console.error('PDF/Cloudinary draft generation/upload error:', e.message || e);
      }
    }

    // send email if requested and service present
    if (body.sendEmail && emailService && emailService.sendSalarySlipEmail) {
      try {
        await emailService.sendSalarySlipEmail({ employee: slip.employee, slip, pdfPath: slip.pdfPath });
        slip.sentAt = new Date();
        slip.status = 'sent';
        slip.lastActivityAt = new Date();
        await slip.save();
      } catch (e: any) {
        console.error('Email send failed', e.message || e);
      }
    }

    if (channel === 'whatsapp') {
      slip.sentAt = slip.sentAt || now;
      slip.status = slip.status === 'draft' ? 'pending_signature' : slip.status;
      slip.lastActivityAt = new Date();
      await slip.save();
    }

    res.json({ success: true, slip });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create slip' });
  }
});

// Get finance documents for frontend
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const slips = await SalarySlip.find({
      $or: [
        { status: 'completed' },
        { status: 'signed' },
        { signedAt: { $exists: true, $ne: null } },
        { pdfUrl: { $exists: true, $ne: null } }
      ]
    }).sort({ createdAt: -1 }).limit(100).lean() as any[];

    const documents = slips.map((s: any) => ({
      id: s.slipId || s._id,
      title: `${s.employee?.name || 'Unknown'} Employee Document.pdf`,
      folder: 'Finance',
      size: 'Unknown',
      uploadedBy: s.employee?.name || 'System',
      date: s.signedAt || s.createdAt,
      url: s.pdfUrl || s.gcsUrl || '',
      publicId: s.pdfPublicId || '',
    }));

    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List slips (basic)
router.get('/', async (req: Request, res: Response) => {
  try {
    const slips = await SalarySlip.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, slips });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get slip by signature token
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const slip: any = await SalarySlip.findOne({ signatureToken: token });
    if (!slip) return res.status(404).json({ success: false, message: 'Slip not found' });

    if (!slip.viewedAt) {
      slip.viewedAt = new Date();
    }
    if (slip.status === 'sent') {
      slip.status = 'pending_signature';
    }
    slip.lastActivityAt = new Date();
    await slip.save();

    res.json({ success: true, slip });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Submit signature for a slip
router.post('/:id/sign', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { signatureData } = req.body as { signatureData?: string };
    if (!signatureData) return res.status(400).json({ success: false, message: 'signatureData required' });

    const slip: any = await SalarySlip.findById(id);
    if (!slip) return res.status(404).json({ success: false, message: 'Slip not found' });

    slip.signatureData = signatureData;
    slip.signedAt = new Date();
    slip.status = 'completed';
    slip.lastActivityAt = new Date();

    // generate signed PDF and upload
    if (generateSalarySlipPDF) {
      try {
        console.log(`Generating signed PDF for slip ${slip._id}...`);
        const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: true });
        slip.pdfPath = pdfPath;
        console.log(`PDF generated at: ${pdfPath}`);

        if (uploadToCloudinary) {
          console.log(`Uploading PDF to Cloudinary...`);
          const destName = `finance/salary_slip_${slip.slipId || slip._id}_signed.pdf`;
          const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
          console.log(`Cloudinary upload success: ${cloudinaryData.cloudinaryUrl}`);
          
          slip.pdfUrl = cloudinaryData.cloudinaryUrl;
          slip.pdfPublicId = cloudinaryData.publicId;
          slip.pdfAssetId = cloudinaryData.assetId;
          slip.pdfFormat = cloudinaryData.format;
          slip.pdfFolder = cloudinaryData.folder;
          slip.pdfFileName = cloudinaryData.fileName;
          slip.storageProvider = 'cloudinary';
        } else {
          console.warn('Cloudinary service not available, skipping upload.');
        }
      } catch (e: any) {
        console.error('PDF/Cloudinary signed generation/upload failed:', e.message || e);
      }
    } else {
      console.warn('PDF Service not available, skipping signed PDF generation.');
    }

    await slip.save();

    // notify owner
    try {
      const ownerEmail = process.env.OWNER_EMAIL || process.env.EMAIL_USER;
      if (emailService && emailService.sendSignatureConfirmationEmail && ownerEmail) {
        await emailService.sendSignatureConfirmationEmail({ slip, ownerEmail });
      }
    } catch (e: any) {
      console.error('Owner notification failed', e.message || e);
    }

    res.json({ success: true, slip });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Failed to submit signature' });
  }
});

export default router;
