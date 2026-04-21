import express, { Request, Response } from 'express';
import { protect, authorize } from '../middleware/authMiddleware';
import { FeedbackTemplate } from '../models/FeedbackTemplate';

const router = express.Router();

// @desc    Get all feedback templates
// @route   GET /api/feedback/templates
// @access  Private (Authenticated users)
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query: any = {};
    
    // Non-admin/manager only see approved templates by default? 
    // Actually, user said: "any authenticated user can view template list"
    // and "list page must show... approval status".
    // So we show all, but maybe filtered. User didn't specify restricted view in list.
    // However, for usage as "live forms", we only use approved ones.
    
    const templates = await FeedbackTemplate.find(query).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch templates' });
  }
});

// @desc    Get pending feedback templates
// @route   GET /api/feedback/templates/pending-approval
// @access  Private (Authenticated users)
router.get('/pending-approval', protect, async (req: Request, res: Response) => {
  try {
    const templates = await FeedbackTemplate.find({ approvalStatus: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch pending templates' });
  }
});

// @desc    Get a single feedback template
// @route   GET /api/feedback/templates/:id
// @access  Private (Authenticated users)
router.get('/:id', protect, async (req: Request, res: Response) => {
  try {
    const template = await FeedbackTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch template' });
  }
});

// @desc    Create a new feedback template
// @route   POST /api/feedback/templates
// @access  Private (All roles)
router.post('/', protect, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { templateName, sections, isActive } = req.body;
    
    const isAutoApproved = user.role === 'admin' || user.role === 'manager';

    const template = await FeedbackTemplate.create({
      templateName,
      sections,
      // admin/manager: use requested isActive or true. staff: forced false.
      isActive: isAutoApproved ? (isActive !== undefined ? isActive : true) : false,
      approvalStatus: isAutoApproved ? 'approved' : 'pending',
      createdBy: user._id,
      createdByName: user.name,
      createdByRole: user.role,
      approvedBy: isAutoApproved ? user._id : undefined,
      approvedAt: isAutoApproved ? new Date() : undefined,
    });

    res.status(201).json({ 
      success: true, 
      template, 
      message: isAutoApproved ? 'Template created successfully' : 'Template submitted for approval' 
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to create template' });
  }
});

// @desc    Update a feedback template
// @route   PUT /api/feedback/templates/:id
// @access  Private (Admin/Manager freely, Staff if theirs but resets to pending)
router.put('/:id', protect, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { templateName, sections, isActive } = req.body;
    const template = await FeedbackTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
    const isCreator = String(template.createdBy) === String(user._id);

    if (!isAdminOrManager && !isCreator) {
      return res.status(403).json({ success: false, message: 'Unauthorized to edit this template' });
    }

    template.templateName = templateName || template.templateName;
    template.sections = sections || template.sections;
    
    if (isAdminOrManager) {
      template.isActive = isActive !== undefined ? isActive : template.isActive;
    } else {
      // Staff edit: reset to pending
      template.approvalStatus = 'pending';
      template.isActive = false;
      template.approvedBy = undefined;
      template.approvedAt = undefined;
    }

    await template.save();
    res.json({ 
      success: true, 
      template,
      message: isAdminOrManager ? 'Template updated' : 'Changes submitted for re-approval'
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to update template' });
  }
});

// @desc    Delete a feedback template
// @route   DELETE /api/feedback/templates/:id
// @access  Private (Admin/Manager only)
router.delete('/:id', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const template = await FeedbackTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    await template.deleteOne();
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete template' });
  }
});

// @desc    Approve a template
// @route   POST /api/feedback/templates/:id/approve
// @access  Private (Admin/Manager only)
router.post('/:id/approve', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const template = await FeedbackTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    template.approvalStatus = 'approved';
    template.isActive = true;
    template.approvedBy = user._id;
    template.approvedAt = new Date();
    template.rejectedBy = undefined;
    template.rejectedAt = undefined;
    template.rejectionReason = undefined;

    await template.save();
    res.json({ success: true, message: 'Template approved successfully', template });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to approve template' });
  }
});

// @desc    Reject a template
// @route   POST /api/feedback/templates/:id/reject
// @access  Private (Admin/Manager only)
router.post('/:id/reject', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { reason } = req.body;
    const template = await FeedbackTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    template.approvalStatus = 'rejected';
    template.isActive = false;
    template.rejectedBy = user._id;
    template.rejectedAt = new Date();
    template.rejectionReason = reason;
    template.approvedBy = undefined;
    template.approvedAt = undefined;

    await template.save();
    res.json({ success: true, message: 'Template rejected', template });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to reject template' });
  }
});

export default router;
