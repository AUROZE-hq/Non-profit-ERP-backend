import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { protect, authorize } from '../middleware/authMiddleware';
import { buildPublicSignUrl } from '../utils/publicUrl';

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
const MAX_EMAIL_ERROR_LENGTH = 500;

function toSafeEmailErrorMessage(error: any) {
  const raw = error?.message || error?.response || error?.code || String(error || 'Unknown email error');
  const normalized = String(raw).replace(/\s+/g, ' ').trim();
  return normalized.slice(0, MAX_EMAIL_ERROR_LENGTH);
}

async function dispatchSlipEmailInBackground(slipId: string) {
  try {
    const slip: any = await SalarySlip.findById(slipId);
    if (!slip) {
      console.warn(`[slips] Background email dispatch skipped; slip not found: ${slipId}`);
      return;
    }

    slip.emailStatus = 'queued';
    slip.emailQueuedAt = new Date();
    slip.emailFailedAt = undefined;
    slip.emailError = undefined;
    slip.lastActivityAt = new Date();
    await slip.save();

    if (!emailService || typeof emailService.sendSalarySlipEmail !== 'function') {
      throw new Error('Email service is unavailable.');
    }

    await emailService.sendSalarySlipEmail({ employee: slip.employee, slip, pdfPath: slip.pdfPath });

    slip.emailStatus = 'sent';
    slip.emailSentAt = new Date();
    slip.emailFailedAt = undefined;
    slip.emailError = undefined;
    slip.sentAt = new Date();

    // Keep signing flow truthful; only mark sent where the existing business state allows.
    if (slip.status === 'draft') {
      slip.status = 'sent';
    }

    slip.lastActivityAt = new Date();
    await slip.save();
  } catch (error: any) {
    const safeError = toSafeEmailErrorMessage(error);
    console.error(`[slips] Background email dispatch failed for slip ${slipId}:`, safeError);

    try {
      const slip: any = await SalarySlip.findById(slipId);
      if (!slip) {
        return;
      }

      slip.emailStatus = 'failed';
      slip.emailFailedAt = new Date();
      slip.emailError = safeError;
      slip.lastActivityAt = new Date();
      await slip.save();
    } catch (persistError: any) {
      console.error(`[slips] Failed to persist email failure state for slip ${slipId}:`, persistError?.message || persistError);
    }
  }
}

async function dispatchSlip(slipId: string, channel: string, shouldDispatchEmail: boolean) {
  const slip: any = await SalarySlip.findById(slipId);
  if (!slip) return;

  const now = new Date();
  if (channel === 'whatsapp') {
    slip.sentAt = slip.sentAt || now;
    slip.status = (slip.status === 'draft' || slip.status === 'pending_signature') ? 'pending_signature' : slip.status;
    slip.lastActivityAt = now;
    await slip.save();
  }

  if (shouldDispatchEmail) {
    // Fire-and-forget async dispatch so SMTP delays never block response time.
    void dispatchSlipEmailInBackground(String(slip._id));
  }
}

// Create a salary slip and optionally send email (PROTECTED)
router.post('/', protect, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body: any = req.body || {};
    const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const sendEmailReq = Boolean(body.sendEmail);
    const now = new Date();
    
    // Generate expiry: 48 hours from now
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    
    const isStaff = user.role === 'staff';
    const approvalStatus = isStaff ? 'pending' : 'not_required';
    
    const slipData: any = {
      employee: body.employee || {},
      period: body.period || { month: 1, year: new Date().getFullYear() },
      earnings: body.earnings || {},
      deductions: body.deductions || {},
      netSalary: body.netSalary || 0,
      notes: body.notes || '',
      role: body.role || 'participation',
      eventTitle: body.eventTitle || '',
      status: (!isStaff && body.sendEmail) ? 'pending_signature' : (body.status || 'draft'),
      deliveryChannel: channel,
      emailStatus: (!isStaff && channel === 'email' && sendEmailReq) ? 'queued' : 'not_requested',
      emailQueuedAt: (!isStaff && channel === 'email' && sendEmailReq) ? now : undefined,
      lastActivityAt: now,
      signatureToken: uuidv4(),
      signatureTokenExpiresAt: expiresAt,
      signatureTokenUsed: false,
      createdBy: user._id,
      createdByRole: user.role,
      approvalStatus,
      approvalRequestedAt: isStaff ? now : undefined,
      requestedChannel: channel,
      sendAfterApproval: isStaff,
    };

    const slip = new SalarySlip(slipData);
    await slip.save();

    // generate PDF if pdf service available
    if (generateSalarySlipPDF) {
      try {
        const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: false });
        slip.pdfPath = pdfPath;

        if (uploadToCloudinary) {
          const destName = `finance/salary_slip_${slip.slipId || slip._id}.pdf`;
          const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
          slip.pdfUrl = cloudinaryData.cloudinaryUrl;
          slip.pdfPublicId = cloudinaryData.publicId;
          slip.pdfAssetId = cloudinaryData.assetId;
          slip.pdfFormat = cloudinaryData.format;
          slip.pdfFolder = cloudinaryData.folder;
          slip.pdfFileName = cloudinaryData.fileName;
          slip.storageProvider = 'cloudinary';
        }
        await slip.save();
      } catch (e: any) {
        console.error('PDF/Cloudinary draft generation/upload error:', e.message || e);
      }
    }

    if (!isStaff) {
      await dispatchSlip(String(slip._id), channel, sendEmailReq && channel === 'email');
    }

    const signUrl = buildPublicSignUrl(String(slip.signatureToken));
    
    res.json({
      success: true,
      message: isStaff ? 'Slip submitted for approval' : 'Slip created successfully',
      slip,
      signatureToken: slip.signatureToken,
      signUrl,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create slip' });
  }
});

// Get pending approvals (PROTECTED)
router.get('/pending-approval', protect, async (req: Request, res: Response) => {
  try {
    const slips = await SalarySlip.find({ approvalStatus: 'pending' })
      .sort({ approvalRequestedAt: -1 })
      .populate('createdBy', 'name email role')
      .lean();
    res.json({ success: true, slips });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Approve a slip (PROTECTED - admin/manager only)
router.post('/:id/approve', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const slip: any = await SalarySlip.findById(req.params.id);
    
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Slip not found' });
    }
    
    if (slip.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Slip is not pending approval' });
    }
    
    slip.approvalStatus = 'approved';
    slip.approvedAt = new Date();
    slip.approvedBy = user._id;
    await slip.save();
    
    // Trigger dispatch
    await dispatchSlip(String(slip._id), slip.requestedChannel, slip.requestedChannel === 'email');
    
    res.json({ success: true, message: 'Slip approved and sent', slip });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject a slip (PROTECTED - admin/manager only)
router.post('/:id/reject', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { reason } = req.body;
    const slip: any = await SalarySlip.findById(req.params.id);
    
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Slip not found' });
    }
    
    if (slip.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: 'Slip is not pending approval' });
    }
    
    slip.approvalStatus = 'rejected';
    slip.rejectedAt = new Date();
    slip.rejectedBy = user._id;
    slip.rejectionReason = reason || '';
    await slip.save();
    
    res.json({ success: true, message: 'Slip rejected', slip });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get finance documents for frontend
router.get('/documents', protect, async (req: Request, res: Response) => {
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
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const slips = await SalarySlip.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, slips });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get slip by signature token (PUBLIC - no auth required)
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const slip: any = await SalarySlip.findOne({ signatureToken: token });
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Slip not found or invalid link' });
    }

    // Security: Check if token is expired
    if (slip.signatureTokenExpiresAt && new Date() > new Date(slip.signatureTokenExpiresAt)) {
      return res.status(410).json({ success: false, message: 'This signature link has expired. Please contact your administrator.' });
    }

    // Security: Check if already signed/used
    if (slip.signedAt || slip.status === 'completed' || slip.status === 'signed') {
      return res.status(400).json({ success: false, message: 'This slip has already been signed. You cannot sign it again.' });
    }

    // Track view activity
    if (!slip.viewedAt) {
      slip.viewedAt = new Date();
    }
    if (slip.status === 'sent') {
      slip.status = 'pending_signature';
    }
    slip.lastActivityAt = new Date();
    await slip.save();

    // Return only minimal safe data - no internal fields
    const safeSlip = {
      _id: slip._id,
      slipId: slip.slipId,
      employee: {
        name: slip.employee?.name || 'Employee',
        email: slip.employee?.email,
      },
      period: slip.period,
      netSalary: slip.netSalary,
      earnings: {
        basicSalary: slip.earnings?.basicSalary || 0,
        allowances: slip.earnings?.allowances || 0,
        bonus: slip.earnings?.bonus || 0,
        overtime: slip.earnings?.overtime || 0,
      },
      deductions: {
        tax: slip.deductions?.tax || 0,
        insurance: slip.deductions?.insurance || 0,
        other: slip.deductions?.other || 0,
      },
      status: slip.status,
      role: slip.role,
      eventTitle: slip.eventTitle,
      signedAt: slip.signedAt || null,
    };

    res.json({ success: true, slip: safeSlip });
  } catch (err: any) {
    console.error('[PUBLIC SIGNING] Get slip error:', err.message);
    res.status(500).json({ success: false, message: 'Unable to load signature page. Please try again or contact support.' });
  }
});

// Submit signature for a slip (PUBLIC - no auth required)
router.post('/token/:token/sign', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const { signatureData } = req.body as { signatureData?: string };

    if (!token) {
      return res.status(400).json({ success: false, message: 'Invalid link' });
    }

    if (!signatureData) {
      return res.status(400).json({ success: false, message: 'Signature is required' });
    }

    const slip: any = await SalarySlip.findOne({ signatureToken: token });
    if (!slip) {
      return res.status(404).json({ success: false, message: 'Slip not found or invalid link' });
    }

    // Security: Check if token is expired
    if (slip.signatureTokenExpiresAt && new Date() > new Date(slip.signatureTokenExpiresAt)) {
      return res.status(410).json({ success: false, message: 'This signature link has expired. Please contact your administrator.' });
    }

    // Security: Check if already signed - prevent re-signing
    if (slip.status === 'completed' || slip.status === 'signed' || slip.signedAt) {
      return res.status(400).json({ success: false, message: 'This slip has already been signed. You cannot sign it again.' });
    }

    // Security: Mark token as used
    slip.signatureTokenUsed = true;

    slip.signatureData = signatureData;
    slip.signedAt = new Date();
    slip.status = 'completed';
    slip.lastActivityAt = new Date();

    // generate signed PDF and upload
    if (generateSalarySlipPDF) {
      try {
        console.log(`[PUBLIC SIGNING] Generating signed PDF for slip ${slip._id}...`);
        const pdfPath = await generateSalarySlipPDF(slip, { includeSignature: true });
        slip.pdfPath = pdfPath;
        console.log(`[PUBLIC SIGNING] PDF generated at: ${pdfPath}`);

        if (uploadToCloudinary) {
          console.log(`[PUBLIC SIGNING] Uploading PDF to Cloudinary...`);
          const destName = `finance/salary_slip_${slip.slipId || slip._id}_signed.pdf`;
          const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
          console.log(`[PUBLIC SIGNING] Cloudinary upload success: ${cloudinaryData.cloudinaryUrl}`);
          
          slip.pdfUrl = cloudinaryData.cloudinaryUrl;
          slip.pdfPublicId = cloudinaryData.publicId;
          slip.pdfAssetId = cloudinaryData.assetId;
          slip.pdfFormat = cloudinaryData.format;
          slip.pdfFolder = cloudinaryData.folder;
          slip.pdfFileName = cloudinaryData.fileName;
          slip.storageProvider = 'cloudinary';
        } else {
          console.warn('[PUBLIC SIGNING] Cloudinary service not available, skipping upload.');
        }
      } catch (e: any) {
        console.error('[PUBLIC SIGNING] PDF/Cloudinary signed generation/upload failed:', e.message || e);
      }
    } else {
      console.warn('[PUBLIC SIGNING] PDF Service not available, skipping signed PDF generation.');
    }

    await slip.save();

    // notify owner (fire-and-forget)
    try {
      const ownerEmail = process.env.OWNER_EMAIL || process.env.EMAIL_USER;
      if (emailService && emailService.sendSignatureConfirmationEmail && ownerEmail) {
        await emailService.sendSignatureConfirmationEmail({ slip, ownerEmail });
      }
    } catch (e: any) {
      console.error('[PUBLIC SIGNING] Owner notification failed:', e.message || e);
    }

    // Return safe response - no internal fields
    res.json({
      success: true,
      message: 'Signature submitted successfully',
      slip: {
        _id: slip._id,
        status: slip.status,
        signedAt: slip.signedAt,
      },
    });
  } catch (err: any) {
    console.error('[PUBLIC SIGNING] Submit signature error:', err.message || err);
    res.status(500).json({ success: false, message: 'Unable to submit signature. Please try again or contact support.' });
  }
});

export default router;
