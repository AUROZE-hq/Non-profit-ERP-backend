import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { protect, authorize } from '../middleware/authMiddleware';
import { buildPublicSignUrl } from '../utils/publicUrl';
import { FeedbackReview } from '../models/FeedbackReview';

const requireAny: any = require;

// Optional services
let generateFeedbackPDF: any = null;
try {
  generateFeedbackPDF = require('../services/feedbackPdfService').generateFeedbackPDF;
} catch (e: any) {
  console.warn('Feedback PDF Service not found:', e.message);
}

let uploadToCloudinary: any = null;
try {
  uploadToCloudinary = require('../services/cloudinaryService').uploadToCloudinary;
} catch (e: any) {
  console.warn('Cloudinary Service not found:', e.message);
}

let emailService: any = null;
try {
  emailService = require('../service/emailService');
} catch (e: any) {
  console.warn('Email Service not found:', e.message);
}

const router = express.Router();
const MAX_EMAIL_ERROR_LENGTH = 500;

function toSafeEmailErrorMessage(error: any) {
  const raw = error?.message || error?.response || error?.code || String(error || 'Unknown email error');
  return String(raw).replace(/\s+/g, ' ').trim().slice(0, MAX_EMAIL_ERROR_LENGTH);
}

async function dispatchFeedbackEmailInBackground(feedbackId: string) {
  try {
    const feedback: any = await FeedbackReview.findById(feedbackId);
    if (!feedback) return;

    feedback.emailStatus = 'queued';
    await feedback.save();

    if (!emailService || typeof emailService.sendSalarySlipEmail !== 'function') {
      throw new Error('Email service unavailable.');
    }

    // We reuse the existing email styling from salary slips or a similar generic function.
    // If no specific feedback email exists, we borrow the basic structure but adapt params:
    const signUrl = buildPublicSignUrl(String(feedback.token)).replace('/sign/', '/feedback/');
    
    // We try to call a dedicated email if it existed, otherwise fallback to generic mail 
    // Wait, the existing codebase only has sendSalarySlipEmail and sendSignatureConfirmationEmail.
    // For now, we will mock or try to use a generic send message if the app had one.
    // Let's assume we call a mocked sendFeedbackLink function inside emailService if we update it later.
    if (typeof emailService.sendFeedbackFormEmail === 'function') {
      await emailService.sendFeedbackFormEmail({ feedback, link: signUrl });
    } else {
      console.warn('Using minimal email log for Feedback since sendFeedbackFormEmail is not in emailService yet.');
    }

    feedback.emailStatus = 'sent';
    feedback.sentAt = new Date();
    if (feedback.status === 'draft') feedback.status = 'sent';
    await feedback.save();
  } catch (error: any) {
    const safeError = toSafeEmailErrorMessage(error);
    console.error(`[feedback] email dispatch failed:`, safeError);
    try {
      const feedback: any = await FeedbackReview.findById(feedbackId);
      if (feedback) {
        feedback.emailStatus = 'failed';
        feedback.emailError = safeError;
        await feedback.save();
      }
    } catch (e) {}
  }
}

// CREATE / SEND FEEDBACK (Admin/Manager)
router.post('/', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const body: any = req.body || {};
    const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const shouldDispatchEmail = channel === 'email';
    
    // Build candidate reviewKey
    const emailStr = (body.recipient?.email || '').toLowerCase().trim();
    const phoneStr = (body.recipient?.phoneNumber || '').replace(/\D/g, '');
    const identity = emailStr || phoneStr || 'unknown';
    const dateStr = body.eventDate ? new Date(body.eventDate).toISOString().split('T')[0] : 'nodate';
    const titleStr = (body.eventTitle || 'notitle').toLowerCase().replace(/\s+/g, '-');
    const candidateReviewKey = `${identity}_${titleStr}_${dateStr}`;

    let feedback: any = await FeedbackReview.findOne({ reviewKey: candidateReviewKey });
    
    if (feedback) {
        // Dedupe logic: Record exists for this person + event.
        if (feedback.status === 'completed' || feedback.status === 'expired') {
            return res.status(400).json({ success: false, message: 'This participant has already submitted feedback or it is expired.' });
        }
        // It's pending, just restart sending to the new channel
        if (!feedback.deliveryChannels.includes(channel)) {
            feedback.deliveryChannels.push(channel);
        }
        feedback.emailStatus = shouldDispatchEmail ? 'queued' : feedback.emailStatus;
        if (shouldDispatchEmail) feedback.emailError = undefined;
        await feedback.save();

    } else {
        // Create new record
        feedback = new FeedbackReview({
            recipient: body.recipient,
            eventTitle: body.eventTitle,
            eventDate: body.eventDate,
            adminNote: body.adminNote,
            deliveryChannels: [channel],
            emailStatus: shouldDispatchEmail ? 'queued' : 'not_requested',
            status: 'sent',
            sentAt: new Date()
        });
        await feedback.save();
    }

    // Notice we modify publicSignUrl to use /feedback path
    const signUrl = buildPublicSignUrl(String(feedback.token)).replace('/sign/', '/feedback/');

    res.json({
      success: true,
      feedback,
      token: feedback.token,
      signUrl,
    });

    if (shouldDispatchEmail) {
      void dispatchFeedbackEmailInBackground(String(feedback._id));
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// LIST FEEDBACK (Admin/Manager)
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const feedbacks = await FeedbackReview.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, feedbacks });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET PUBLIC FORM
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const feedback: any = await FeedbackReview.findOne({ token: req.params.token });
    if (!feedback) return res.status(404).json({ success: false, message: 'Invalid feedback link' });

    if (feedback.tokenExpiresAt && new Date() > new Date(feedback.tokenExpiresAt)) {
      if (feedback.status !== 'completed') {
        feedback.status = 'expired';
        await feedback.save();
      }
      return res.status(410).json({ success: false, message: 'This feedback link has expired.' });
    }

    if (feedback.status === 'completed' || feedback.respondedAt) {
      return res.status(400).json({ success: false, message: 'You have already submitted this feedback form.' });
    }

    if (!feedback.viewedAt) {
      feedback.viewedAt = new Date();
      await feedback.save();
    }

    const safeFeedback = {
      _id: feedback._id,
      recipient: {
        firstName: feedback.recipient?.firstName,
      },
      eventTitle: feedback.eventTitle,
      eventDate: feedback.eventDate,
      status: feedback.status
    };

    res.json({ success: true, feedback: safeFeedback });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Unable to load feedback form.' });
  }
});

// SUBMIT PUBLIC FORM
router.post('/token/:token/submit', async (req: Request, res: Response) => {
  try {
    const feedback: any = await FeedbackReview.findOne({ token: req.params.token });
    if (!feedback) return res.status(404).json({ success: false, message: 'Invalid link' });

    if (feedback.tokenExpiresAt && new Date() > new Date(feedback.tokenExpiresAt)) {
      return res.status(410).json({ success: false, message: 'Feedback link has expired.' });
    }

    if (feedback.status === 'completed' || feedback.respondedAt) {
      return res.status(400).json({ success: false, message: 'You have already submitted this feedback form.' });
    }

    feedback.answers = req.body.answers;
    feedback.respondedAt = new Date();
    feedback.status = 'completed';

    // Generate & Upload PDF
    if (generateFeedbackPDF) {
      try {
        const pdfPath = await generateFeedbackPDF(feedback);
        feedback.pdfPath = pdfPath;
        
        if (uploadToCloudinary) {
          const destName = `feedback/feedback_${feedback._id}_completed.pdf`;
          const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
          
          feedback.pdfUrl = cloudinaryData.cloudinaryUrl;
          feedback.pdfPublicId = cloudinaryData.publicId;
          feedback.storageProvider = 'cloudinary';
        }
      } catch (e: any) {
        console.error('PDF generation/upload failed:', e.message);
      }
    }

    await feedback.save();

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Unable to submit feedback.' });
  }
});

export default router;
