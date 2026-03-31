import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// allow safe require for optional JS services
const requireAny: any = require;

// Try to require existing services (may not exist)
let generateSalarySlipPDF: any = null;
try { generateSalarySlipPDF = requireAny('../services/pdfService').generateSalarySlipPDF; } catch (_) { /* noop */ }
let uploadToGCS: any = null;
try { uploadToGCS = requireAny('../services/gcsService').uploadToGCS; } catch (_) { /* noop */ }
let emailService: any = null;
try { emailService = requireAny('../service/emailService'); } catch (_) { /* noop */ }

// Import SalarySlip model (TypeScript model file exists)
import { SalarySlip } from '../models/SignatureSchema';

const router = express.Router();

// Create a salary slip and optionally send email
router.post('/', async (req: Request, res: Response) => {
  try {
    const body: any = req.body || {};
    const slipData: any = {
      employee: body.employee || {},
      period: body.period || { month: 1, year: new Date().getFullYear() },
      earnings: body.earnings || {},
      deductions: body.deductions || {},
      netSalary: body.netSalary || 0,
      notes: body.notes || '',
      status: body.sendEmail ? 'pending_signature' : (body.status || 'draft'),
      signatureToken: uuidv4(),
    };

    const slip = new SalarySlip(slipData);
    await slip.save();

    // generate PDF if pdf service available
    if (generateSalarySlipPDF) {
      try {
        const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: false });
        slip.pdfPath = pdfPath;
        // upload to GCS if available
        if (uploadToGCS) {
          const destName = `finance/salary_slip_${slip.slipId || slip._id}.pdf`;
          const { gcsUrl, gcsFileName } = await uploadToGCS(pdfPath, destName);
          slip.gcsUrl = gcsUrl;
          slip.gcsFileName = gcsFileName;
        }
        await slip.save();
      } catch (e: any) {
        console.error('PDF/GCS generation error', e.message || e);
      }
    }

    // send email if requested and service present
    if (body.sendEmail && emailService && emailService.sendSalarySlipEmail) {
      try {
        await emailService.sendSalarySlipEmail({ employee: slip.employee, slip, pdfPath: slip.pdfPath });
        slip.sentAt = new Date();
        slip.status = 'sent';
        await slip.save();
      } catch (e: any) {
        console.error('Email send failed', e.message || e);
      }
    }

    res.json({ success: true, slip });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create slip' });
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
    const slip = await SalarySlip.findOne({ signatureToken: token }).lean();
    if (!slip) return res.status(404).json({ success: false, message: 'Slip not found' });
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

    // generate signed PDF and upload
    if (generateSalarySlipPDF) {
      try {
        const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: true });
        slip.pdfPath = pdfPath;
        if (uploadToGCS) {
          const destName = `finance/salary_slip_${slip.slipId || slip._id}_signed.pdf`;
          const { gcsUrl, gcsFileName } = await uploadToGCS(pdfPath, destName);
          slip.gcsUrl = gcsUrl;
          slip.gcsFileName = gcsFileName;
        }
      } catch (e: any) {
        console.error('PDF/GCS signed generation failed', e.message || e);
      }
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
