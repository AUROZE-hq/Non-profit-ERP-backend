import express, { Request, Response } from 'express';
import { protect, authorize } from '../middleware/authMiddleware';
import { AnonymousFeedbackForm } from '../models/AnonymousFeedbackForm';
import { AnonymousFeedbackResponse } from '../models/AnonymousFeedbackResponse';
import { FeedbackTemplate } from '../models/FeedbackTemplate';

const router = express.Router();

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

// CREATE ANONYMOUS FORM LINK (Admin/Manager)
router.post('/', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { eventTitle, eventDate, eventId, templateId, adminNote } = req.body;

    if (!templateId) {
      return res.status(400).json({ success: false, message: 'Template is required.' });
    }

    const template = await FeedbackTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    if (template.approvalStatus !== 'approved' || !template.isActive) {
      return res.status(400).json({ success: false, message: 'Template must be approved and active.' });
    }

    const form = new AnonymousFeedbackForm({
      eventTitle,
      eventDate,
      eventId,
      templateId,
      templateName: template.templateName,
      templateSnapshot: {
        templateName: template.templateName,
        sections: template.sections
      },
      adminNote,
      createdBy: (req as any).user._id
    });

    await form.save();

    res.status(201).json({ success: true, form });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// LIST ANONYMOUS FORMS (Admin/Manager)
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const forms = await AnonymousFeedbackForm.find()
      .sort({ createdAt: -1 })
      .lean();

    // Get response counts for each form
    const formsWithCounts = await Promise.all(forms.map(async (form) => {
      const responseCount = await AnonymousFeedbackResponse.countDocuments({ formId: form._id });
      return { ...form, responseCount };
    }));

    res.json({ success: true, forms: formsWithCounts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET ANONYMOUS FORM PUBLIC DATA
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const form = await AnonymousFeedbackForm.findOne({ token: req.params.token, isActive: true });
    if (!form) {
      return res.status(404).json({ success: false, message: 'Feedback link is invalid or inactive.' });
    }

    res.json({
      success: true,
      form: {
        _id: form._id,
        eventTitle: form.eventTitle,
        eventDate: form.eventDate,
        templateSnapshot: form.templateSnapshot
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SUBMIT ANONYMOUS RESPONSE (Public)
router.post('/token/:token/submit', async (req: Request, res: Response) => {
  try {
    const form = await AnonymousFeedbackForm.findOne({ token: req.params.token, isActive: true });
    if (!form) {
      return res.status(404).json({ success: false, message: 'Feedback link is invalid or inactive.' });
    }

    const response = new AnonymousFeedbackResponse({
      formId: form._id,
      answers: req.body.answers,
      submittedAt: new Date()
    });

    // Generate PDF for this specific submission
    if (generateFeedbackPDF) {
      try {
        // Construct a mock feedback object for the PDF service
        // It needs recipient name (placeholder), event info, and answers.
        const pdfSim = {
          recipient: { firstName: 'Anonymous', lastName: 'Participant' },
          eventTitle: form.eventTitle,
          eventDate: form.eventDate,
          templateSnapshot: form.templateSnapshot,
          answers: req.body.answers,
          respondedAt: response.submittedAt,
          reviewKey: `anon_${response._id}`
        };

        const pdfPath = await generateFeedbackPDF(pdfSim);
        response.pdfUrl = pdfPath; // Local path fallback
        
        if (uploadToCloudinary) {
          const destName = `feedback/anonymous_${response._id}_completed.pdf`;
          const cloudinaryData = await uploadToCloudinary(pdfPath, destName);
          
          response.pdfUrl = cloudinaryData.cloudinaryUrl;
          response.pdfPublicId = cloudinaryData.publicId;
          response.storageProvider = 'cloudinary';
        }
      } catch (pdfErr: any) {
        console.error('Anonymous Feedback PDF error:', pdfErr.message);
      }
    }

    await response.save();

    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// TOGGLE FORM STATUS
router.patch('/:id/toggle', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const form = await AnonymousFeedbackForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Form not found.' });
    }

    form.isActive = !form.isActive;
    await form.save();

    res.json({ success: true, form });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
