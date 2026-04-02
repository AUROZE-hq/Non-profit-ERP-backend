import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
const requireAny: any = require;
let emailService: any = null;
try { emailService = requireAny('../service/emailService'); } catch (_) { /* noop */ }

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';
const JWT_EXPIRES_IN = '7d';

export const authService = {
  // Generate JWT
  generateToken(user: IUser): string {
    return jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  },

  // Login logic
  async login(identifier: string, password: string) {
    // Search by email or name
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { name: identifier }
      ]
    });

    if (!user) throw new Error('Invalid credentials');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new Error('Invalid credentials');

    const token = this.generateToken(user);
    return { user, token };
  },

  // Register logic
  async register(userData: { name: string; email: string; password: string; role?: string }) {
    const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
    if (existingUser) throw new Error('User with this email already exists');

    const user = new User(userData);
    await user.save();

    const token = this.generateToken(user);
    return { user, token };
  },

  // Forgot password logic
  async forgotPassword(email: string): Promise<string> {
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await user.save();

    if (emailService && emailService.sendForgotPasswordEmail) {
      // We will need to implement this in emailService or handle it here
      const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password/${token}`;
      await emailService.sendForgotPasswordEmail({ email: user.email, name: user.name, resetUrl });
    }

    return token;
  },

  // Reset password logic
  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) throw new Error('Invalid or expired reset token');

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    return user;
  },
};
