import express, { Request, Response } from 'express';
import { protect, authorize } from '../middleware/authMiddleware';
import { Event } from '../models/Event';

const router = express.Router();

// @desc    Create a new event
// @route   POST /api/events
// @access  Private
router.post('/', protect, async (req: Request, res: Response) => {
  try {
    const { eventName, eventDate, additionalNote } = req.body;
    const user = (req as any).user;

    const isAuthorized = user.role === 'admin' || user.role === 'manager';

    const event = await Event.create({
      eventName,
      eventDate,
      additionalNote,
      createdBy: user._id,
      createdByName: user.name,
      createdByRole: user.role,
      approvalStatus: isAuthorized ? 'approved' : 'pending',
      approvedBy: isAuthorized ? user._id : undefined,
      approvedAt: isAuthorized ? new Date() : undefined,
    });

    res.status(201).json({
      success: true,
      event,
      message: isAuthorized ? 'Event created successfully' : 'Event submitted for approval',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Failed to create event' });
  }
});

// @desc    Get all events
// @route   GET /api/events
// @access  Private
router.get('/', protect, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query: any = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const events = await Event.find(query).sort({ createdAt: -1 });
    res.json({ success: true, events });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch events' });
  }
});

// @desc    Get events summary
// @route   GET /api/events/summary
// @access  Private
router.get('/summary', protect, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query: any = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      };
    }

    const allEvents = await Event.find(query);
    const now = new Date();

    const summary = {
      all: allEvents.length,
      pending: allEvents.filter((e) => e.approvalStatus === 'pending').length,
      upcoming: allEvents.filter((e) => e.approvalStatus === 'approved' && new Date(e.eventDate) > now).length,
      completed: allEvents.filter((e) => e.approvalStatus === 'approved' && new Date(e.eventDate) <= now).length,
    };

    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch summary' });
  }
});

// @desc    Approve an event
// @route   POST /api/events/:id/approve
// @access  Private (Admin/Manager only)
router.post('/:id/approve', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    event.approvalStatus = 'approved';
    event.approvedBy = user._id;
    event.approvedAt = new Date();
    await event.save();

    res.json({ success: true, message: 'Event approved successfully', event });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to approve event' });
  }
});

// @desc    Reject an event
// @route   POST /api/events/:id/reject
// @access  Private (Admin/Manager only)
router.post('/:id/reject', protect, authorize('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { reason } = req.body;
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    event.approvalStatus = 'rejected';
    event.rejectedBy = user._id;
    event.rejectedAt = new Date();
    event.rejectionReason = reason;
    await event.save();

    res.json({ success: true, message: 'Event rejected', event });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to reject event' });
  }
});

export default router;
