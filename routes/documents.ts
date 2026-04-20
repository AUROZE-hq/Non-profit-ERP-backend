import express, { Request, Response } from 'express';
import { protect } from '../middleware/authMiddleware';
import { SalarySlip } from '../models/SignatureSchema';
import { FeedbackReview } from '../models/FeedbackReview';

const router = express.Router();

// GET /api/documents/dashboard
router.get('/dashboard', protect, async (req: Request, res: Response) => {
  try {
    // 1. Fetch Salary Slips (Finance)
    const slips = await SalarySlip.find({
      $or: [
        { status: 'completed' },
        { status: 'signed' },
        { signedAt: { $exists: true, $ne: null } },
        { pdfUrl: { $exists: true, $ne: null } }
      ]
    }).sort({ createdAt: -1 }).lean();

    // 2. Fetch Feedback Reviews (Programs)
    const feedbacks = await FeedbackReview.find({
      $or: [
        { status: 'completed' },
        { pdfUrl: { $exists: true, $ne: null } }
      ]
    }).sort({ createdAt: -1 }).lean();

    // 3. Map to Document Objects
    const financeDocs = slips.map((s: any) => ({
      id: s.slipId || s._id,
      title: `${s.employee?.name || 'Honorarium'} Document.pdf`,
      folder: 'Finance',
      sizeBytes: 0, // Not tracked
      uploadedBy: s.employee?.name || 'System',
      date: s.signedAt || s.createdAt,
      isShared: false,
      url: s.pdfUrl || s.gcsUrl || ''
    }));

    const programDocs = feedbacks.map((f: any) => ({
      id: f._id,
      title: `Feedback_${f.recipient?.firstName}_${f.eventTitle || 'Event'}.pdf`,
      folder: 'Programs',
      sizeBytes: 0, // Not tracked
      uploadedBy: `${f.recipient?.firstName} ${f.recipient?.lastName}`,
      date: f.respondedAt || f.createdAt,
      isShared: false,
      url: f.pdfUrl || ''
    }));

    const allDocuments = [...financeDocs, ...programDocs].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // 4. Calculate Folder Counts
    const folderCounts: Record<string, number> = {
      Reports: 0,
      Governance: 0,
      Programs: programDocs.length,
      Donations: 0,
      Finance: financeDocs.length,
      Volunteers: 0
    };

    const folders = [
      { name: 'Reports', count: folderCounts.Reports, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      { name: 'Governance', count: folderCounts.Governance, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
      { name: 'Programs', count: folderCounts.Programs, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
      { name: 'Donations', count: folderCounts.Donations, color: 'text-rose-500', bg: 'bg-rose-500/10' },
      { name: 'Finance', count: folderCounts.Finance, color: 'text-amber-500', bg: 'bg-amber-500/10' },
      { name: 'Volunteers', count: folderCounts.Volunteers, color: 'text-purple-500', bg: 'bg-purple-500/10' }
    ];

    res.json({
      success: true,
      summary: {
        totalDocuments: allDocuments.length,
        folderCount: folders.length,
        storageUsedBytes: 0,
        sharedFiles: 0
      },
      folders,
      documents: allDocuments
    });

  } catch (error: any) {
    console.error('Documents Dashboard Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
