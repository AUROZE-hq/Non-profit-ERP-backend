import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { normalizePublicAppUrl } from './utils/publicUrl';

const slipRoutes: express.Router = require('./routes/slips').default;
const suggestionRoutes: express.Router = require('./routes/suggestions').default;
const taskRoutes: express.Router = require('./routes/tasks').default;
const authRoutes: express.Router = require('./routes/auth').default;
const userRoutes: express.Router = require('./routes/user').default;
const feedbackRoutes: express.Router = require('./routes/feedback').default;
const financeRoutes: express.Router = require('./routes/finance').default;
const documentsRoutes: express.Router = require('./routes/documents').default;
const eventRoutes: express.Router = require('./routes/events').default;
const feedbackTemplateRoutes: express.Router = require('./routes/feedbackTemplates').default;
const anonymousFeedbackRoutes: express.Router = require('./routes/anonymousFeedback').default;

const app = express();
const PORT = process.env.PORT || 5000;

// Determine the single allowed origin from FRONTEND_APP_URL.
// When not set, default to localhost frontend origin.
let allowedOrigin = '';
try {
  allowedOrigin = new URL(normalizePublicAppUrl(process.env.FRONTEND_APP_URL)).origin;
} catch (error: any) {
  console.warn(`CORS: invalid FRONTEND_APP_URL configuration: ${error?.message || error}`);
  allowedOrigin = 'http://localhost:5176';
}

// ── Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without an origin (e.g., curl, server-to-server).
    if (!origin) return callback(null, true);

    // Require exact frontend origin match.
    if (allowedOrigin) {
      if (origin === allowedOrigin) return callback(null, true);
      // Reject by not providing CORS headers (callback with false) instead of throwing.
      console.warn(`CORS: rejecting origin ${origin}; expected ${allowedOrigin}`);
      return callback(null, false);
    }

    // Fallback: allow common local dev origins.
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);

    // Otherwise disallow silently.
    console.warn(`CORS: rejecting origin ${origin}; no valid FRONTEND_APP_URL configured`);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Temp directory
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ── Routes
app.use('/api/slips', slipRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/feedback/templates', feedbackTemplateRoutes);
app.use('/api/feedback/anonymous', anonymousFeedbackRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});


// Validate JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is missing.');
  process.exit(1);
}

// Validate MONGODB_URI before attempting connection
const rawMongoUri = process.env.MONGODB_URI || '';
if (!rawMongoUri || rawMongoUri.includes('<db_password') || rawMongoUri.includes('<password')) {
  console.error('❌ MONGODB_URI is not set or contains a placeholder.');
  console.error('  - Open .env and set a proper MONGODB_URI, for example:');
  console.error('    mongodb+srv://<user>:<password>@cluster0.gikzcgt.mongodb.net/myDatabase?retryWrites=true&w=majority');
  console.error('  - If the password has special characters, URL-encode it (use encodeURIComponent).');
  process.exit(1);
}

// Connect to MongoDB & start
mongoose
  .connect(rawMongoUri, { autoIndex: true })
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err: any) => {
    console.error('❌ MongoDB connection failed:');
    console.error('  message:', err.message);
    if (err.name === 'MongoParseError' || /ENOTFOUND/i.test(err.message)) {
      console.error('  - DNS/host lookup failed. Check the cluster host in MONGODB_URI.');
    }
    if (/authentication failed|bad auth/i.test(err.message)) {
      console.error('  - Authentication failed. Verify username and password in MONGODB_URI.');
    }
    process.exit(1);
  });
