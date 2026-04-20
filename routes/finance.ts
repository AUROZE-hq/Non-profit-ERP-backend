import express, { Request, Response } from 'express';
import { protect } from '../middleware/authMiddleware';
import { SalarySlip } from '../models/SignatureSchema';

const router = express.Router();

// GET /api/finance/dashboard
router.get('/dashboard', protect, async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 1. Summary Stats
    // Total Expenses: Sum of netSalary from completed/signed slips
    const expenseAggregation = await SalarySlip.aggregate([
      { 
        $match: { 
          $or: [
            { status: 'completed' },
            { signedAt: { $ne: null } }
          ]
        }
      },
      { $group: { _id: null, total: { $sum: '$netSalary' } } }
    ]);
    const totalExpenses = expenseAggregation.length > 0 ? expenseAggregation[0].total : 0;

    // Pending Approvals Count
    const pendingApprovalsCount = await SalarySlip.countDocuments({ approvalStatus: 'pending' });

    // 2. Monthly Expenses vs Budget Chart Data (Last 6 Months)
    const monthlyAggregation = await SalarySlip.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
          $or: [
            { status: 'completed' },
            { signedAt: { $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          expenses: { $sum: '$netSalary' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyExpensesVsBudget = [];
    
    // Fill in last 6 months
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(now.getMonth() - (5 - i));
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // MongoDB month is 1-indexed

      const found = monthlyAggregation.find(m => m._id.year === year && m._id.month === month);
      monthlyExpensesVsBudget.push({
        month: monthNames[month - 1],
        expenses: found ? found.expenses : 0,
        budget: 0 // Mock budget for now as requested
      });
    }

    // 3. Transactions & Approvals Lists
    const recentTransactions = await SalarySlip.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const pendingApprovals = await SalarySlip.find({ approvalStatus: 'pending' })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email role')
      .lean();

    res.json({
      success: true,
      summary: {
        totalRevenue: 0,
        totalExpenses,
        netIncome: 0 - totalExpenses,
        pendingApprovals: pendingApprovalsCount
      },
      monthlyExpensesVsBudget,
      budgetByCategory: [], // Empty for now
      recentTransactions: recentTransactions.map(t => ({
        id: t._id,
        date: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '—',
        description: t.eventTitle || t.notes || 'Honorarium Payment',
        category: 'Honorarium',
        amount: `-$${t.netSalary.toLocaleString()}`,
        status: t.approvalStatus === 'pending' ? 'Pending' : (t.signedAt ? 'Completed' : 'Sent')
      })),
      budgetOverview: [],
      pendingApprovals: pendingApprovals.map(p => ({
        id: p._id,
        date: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '—',
        description: p.eventTitle || 'Honorarium Approval Request',
        category: 'Approval',
        amount: `-$${p.netSalary.toLocaleString()}`,
        status: 'Pending',
        requester: p.createdBy?.name || 'Staff'
      }))
    });

  } catch (error: any) {
    console.error('Finance Dashboard Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
