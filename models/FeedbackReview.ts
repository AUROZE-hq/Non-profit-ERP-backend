import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type FeedbackStatus = 'draft' | 'sent' | 'completed' | 'expired';

export interface IFeedbackReview extends Document {
  recipient: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  };

  eventTitle?: string;
  eventDate: Date;
  adminNote?: string;

  deliveryChannels: string[]; // 'email', 'whatsapp'
  emailStatus?: 'not_requested' | 'queued' | 'sent' | 'failed';
  emailError?: string;

  reviewKey: string; // Used for deduplication
  token: string;
  tokenExpiresAt: Date;

  status: FeedbackStatus;

  sentAt?: Date;
  respondedAt?: Date;
  viewedAt?: Date;

  pdfPath?: string;
  pdfUrl?: string;
  pdfPublicId?: string;
  storageProvider?: string;

  answers?: {
    sessionExperience?: string[];
    groupConnection?: string[];
    personalImpact?: string[];
    sessionStructure?: string[];
    expectationsMet?: string;
    weeklyWellbeing?: string[];
    optionalFeedback?: string;
  };

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackReviewSchema = new Schema<IFeedbackReview>(
  {
    recipient: {
      firstName: { type: String, required: true },
      middleName: { type: String },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      phoneNumber: { type: String },
    },

    eventTitle: { type: String },
    eventDate: { type: Date, required: true },
    adminNote: { type: String },

    deliveryChannels: [{ type: String, enum: ['email', 'whatsapp'] }],
    emailStatus: {
      type: String,
      enum: ['not_requested', 'queued', 'sent', 'failed'],
      default: 'not_requested',
    },
    emailError: { type: String },

    reviewKey: { type: String, unique: true },
    token: { type: String, unique: true },
    tokenExpiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days

    status: {
      type: String,
      enum: ['draft', 'sent', 'completed', 'expired'],
      default: 'draft',
    },

    sentAt: { type: Date },
    respondedAt: { type: Date },
    viewedAt: { type: Date },

    pdfPath: { type: String },
    pdfUrl: { type: String },
    pdfPublicId: { type: String },
    storageProvider: { type: String },

    answers: {
      sessionExperience: [{ type: String }],
      groupConnection: [{ type: String }],
      personalImpact: [{ type: String }],
      sessionStructure: [{ type: String }],
      expectationsMet: { type: String },
      weeklyWellbeing: [{ type: String }],
      optionalFeedback: { type: String },
    },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate token & reviewKey if missing
feedbackReviewSchema.pre('save', function (next) {
  if (!this.token) {
    this.token = uuidv4();
  }
  if (!this.reviewKey) {
    const emailStr = (this.recipient?.email || '').toLowerCase().trim();
    const phoneStr = (this.recipient?.phoneNumber || '').replace(/\D/g, '');
    const identity = emailStr || phoneStr || 'unknown';
    const dateStr = this.eventDate ? new Date(this.eventDate).toISOString().split('T')[0] : 'nodate';
    const titleStr = (this.eventTitle || 'notitle').toLowerCase().replace(/\s+/g, '-');
    
    // Identity + Title + Date forms a unique composite key representing one person per event.
    this.reviewKey = `${identity}_${titleStr}_${dateStr}`;
  }
  next();
});

export const FeedbackReview = mongoose.model<IFeedbackReview>('FeedbackReview', feedbackReviewSchema);
