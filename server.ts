import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

const slipRoutes: express.Router = require('./routes/slips').default;
const taskRoutes: express.Router = require('./routes/tasks').default;
const authRoutes: express.Router = require('./routes/auth').default;
const userRoutes: express.Router = require('./routes/user').default;

const app = express();
const PORT = process.env.PORT || 5000;

// Determine the single allowed origin from APP_URL (normalized to an origin).
// When APP_URL is not set, allow localhost origins for development.
let allowedOrigin = '';
if (process.env.APP_URL) {
  const raw = process.env.APP_URL.trim();
  try {
    allowedOrigin = new URL(raw).origin;
  } catch (_err) {
    allowedOrigin = raw; // fallback to raw value if it isn't a full URL
  }
}

// ── Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without an origin (e.g., curl, server-to-server).
    if (!origin) return callback(null, true);

    // If APP_URL is set, require an exact origin match.
    if (allowedOrigin) {
      if (origin === allowedOrigin) return callback(null, true);
      // Reject by not providing CORS headers (callback with false) instead of throwing.
      console.warn(`CORS: rejecting origin ${origin}; expected ${allowedOrigin}`);
      return callback(null, false);
    }

    // APP_URL not set: allow common local dev origins.
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);

    // Otherwise disallow silently.
    console.warn(`CORS: rejecting origin ${origin}; no APP_URL configured`);
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
app.use('/api/tasks', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

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
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});


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
      console.log(`📧 Email: ${process.env.EMAIL_USER}`);
      console.log(`☁️  GCS Bucket: ${process.env.GCS_BUCKET_NAME}`);
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
