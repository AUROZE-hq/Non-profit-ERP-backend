import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { protect, authorize } from '../middleware/authMiddleware';
import { suggestionService } from '../service/suggestionService';
import { sanitizeSuggestionComment, validateSuggestionTargetUrl } from '../utils/suggestionValidation';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'suggestions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const maxFileSizeBytes = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('Only PNG, JPG, JPEG, and WEBP images are allowed.'));
    }
    cb(null, true);
  },
});

function getSafeUser(req: Request) {
  const user: any = (req as any).user;
  if (!user) {
    throw new Error('Not authorized');
  }

  return {
    id: String(user._id || user.id),
    name: String(user.name || '').trim(),
    email: String(user.email || '').trim().toLowerCase(),
    role: String(user.role || '').trim().toLowerCase(),
  };
}

function canAccessSuggestion(user: any, suggestion: any) {
  return user.role === 'manager' || String(suggestion.createdBy?._id || suggestion.createdBy) === String(user.id);
}

router.post('/', protect, upload.single('screenshot'), async (req: Request, res: Response) => {
  try {
    const user = getSafeUser(req);
    const comment = sanitizeSuggestionComment(req.body?.comment);

    if (comment.length < 3) {
      return res.status(400).json({ success: false, message: 'Comment must be at least 3 characters.' });
    }

    if (comment.length > 2000) {
      return res.status(400).json({ success: false, message: 'Comment must be 2000 characters or fewer.' });
    }

    let targetUrl: string | undefined;
    try {
      targetUrl = validateSuggestionTargetUrl(req.body?.targetUrl);
    } catch (validationError: any) {
      return res.status(400).json({ success: false, message: validationError.message || 'Invalid target URL.' });
    }

    const file = req.file as Express.Multer.File | undefined;
    const suggestion = await suggestionService.createSuggestion({
      comment,
      targetUrl,
      screenshotPath: file ? file.path : undefined,
      screenshotOriginalName: file ? file.originalname : undefined,
      createdBy: user.id as any,
      createdByName: user.name,
      createdByEmail: user.email,
      createdByRole: user.role,
    });

    return res.status(201).json({
      success: true,
      message: 'Suggestion submitted successfully.',
      suggestion: {
        _id: suggestion._id,
        comment: suggestion.comment,
        targetUrl: suggestion.targetUrl,
        hasScreenshot: Boolean(suggestion.screenshotPath),
        createdByName: suggestion.createdByName,
        createdByEmail: suggestion.createdByEmail,
        createdByRole: suggestion.createdByRole,
        createdAt: suggestion.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[suggestions] Create failed:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to submit suggestion.' });
  }
});

router.get('/', protect, authorize('manager'), async (_req: Request, res: Response) => {
  try {
    const suggestions = await suggestionService.getAllSuggestions();
    return res.json({ success: true, suggestions });
  } catch (error: any) {
    console.error('[suggestions] List failed:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load suggestions.' });
  }
});

router.get('/mine', protect, async (req: Request, res: Response) => {
  try {
    const user = getSafeUser(req);
    const suggestions = await suggestionService.getSuggestionsByUser(user.id);
    return res.json({ success: true, suggestions });
  } catch (error: any) {
    console.error('[suggestions] Mine failed:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load your suggestions.' });
  }
});

router.get('/:id/screenshot', protect, async (req: Request, res: Response) => {
  try {
    const user = getSafeUser(req);
    const suggestion = await suggestionService.getSuggestionById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({ success: false, message: 'Suggestion not found.' });
    }

    if (!canAccessSuggestion(user, suggestion)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this screenshot.' });
    }

    if (!suggestion.screenshotPath) {
      return res.status(404).json({ success: false, message: 'Screenshot not available.' });
    }

    const resolvedPath = path.resolve(suggestion.screenshotPath);
    if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
      return res.status(400).json({ success: false, message: 'Invalid screenshot path.' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Screenshot file not found.' });
    }

    return res.sendFile(resolvedPath);
  } catch (error: any) {
    console.error('[suggestions] Screenshot failed:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Failed to load screenshot.' });
  }
});

export default router;