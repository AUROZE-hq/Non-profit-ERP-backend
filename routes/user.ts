import express, { Request, Response } from 'express';
import { userService } from '../service/userService';

const router = express.Router();

// Get all users from database
router.get('/', async (req: Request, res: Response) => {
	try {
		const users = await userService.getAllUsers();
		res.json({ success: true, users });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message || 'Failed to fetch users' });
	}
});

export default router;
