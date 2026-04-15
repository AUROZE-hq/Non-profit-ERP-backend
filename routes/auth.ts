import express, { Request, Response } from 'express';
import { authService } from '../service/authService';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Login route
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, email, password } = req.body;
    // support both 'identifier' and 'email' keys for backward compatibility
    const id = identifier || email;
    const { user, token } = await authService.login(id, password);
    res.json({ success: true, user: { id: user._id, email: user.email, name: user.name, role: user.role }, token });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message });
  }
});

// Register route
router.post('/register', async (req: Request, res: Response) => {
  if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
    return res.status(403).json({ success: false, message: 'Public registration is disabled' });
  }
  try {
    const { name, email, password, role } = req.body;
    const { user, token } = await authService.register({ name, email, password, role });
    res.status(201).json({ success: true, user: { id: user._id, email: user.email, name: user.name, role: user.role }, token });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Forgot password route
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);
    res.json({ success: true, message: 'Password reset link sent to email' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Reset password route
router.post('/reset-password/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    await authService.resetPassword(token, password);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get current user profile
router.get('/me', protect, (req: Request, res: Response) => {
  res.json({ success: true, user: (req as any).user });
});

export default router;
