import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Status Type
 */
export type SalarySlipStatus =
  | 'draft'
  | 'sent'
  | 'pending_signature'
  | 'signed'
  | 'completed';

export type DeliveryChannel = 'email' | 'whatsapp';

export type EmailDeliveryStatus = 'not_requested' | 'queued' | 'sent' | 'failed';

/**
 * Interface
 */
export interface ISalarySlip extends Document {
  slipId?: string;

  employee: {
    ref?: Types.ObjectId;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    name?: string;
    email?: string;
    department?: string;
    position?: string;
    employeeId?: string;
  };

  period: {
    month: number;
    year: number;
  };

  earnings: {
    basicSalary?: number;
    allowances?: number;
    bonus?: number;
    overtime?: number;
  };

  deductions: {
    tax?: number;
    insurance?: number;
    other?: number;
  };

  netSalary: number;

  notes?: string;

  status: SalarySlipStatus;

  deliveryChannel?: DeliveryChannel;
  emailStatus?: EmailDeliveryStatus;
  emailError?: string;
  emailQueuedAt?: Date;
  emailSentAt?: Date;
  emailFailedAt?: Date;

  sentAt?: Date;
  viewedAt?: Date;
  signedAt?: Date;
  lastActivityAt?: Date;

  signatureData?: string;
  signatureToken?: string;
  signatureTokenExpiresAt?: Date;
  signatureTokenUsed?: boolean;

  pdfPath?: string;
  gcsUrl?: string;
  gcsFileName?: string;

  pdfUrl?: string;
  pdfPublicId?: string;
  pdfAssetId?: string;
  pdfFormat?: string;
  pdfFolder?: string;
  pdfFileName?: string;
  storageProvider?: string;

  role?: 'leadership' | 'participation';
  eventTitle?: string;

  createdBy?: Types.ObjectId;
  createdByRole?: 'admin' | 'manager' | 'staff';
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';
  approvalRequestedAt?: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectionReason?: string;
  requestedChannel?: 'email' | 'whatsapp';
  sendAfterApproval?: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Schema
 */
const salarySlipSchema = new Schema<ISalarySlip>(
  {
    slipId: { type: String, unique: true },

    role: {
      type: String,
      enum: ['leadership', 'participation'],
      default: 'participation',
    },
    eventTitle: { type: String, default: '' },

    employee: {
      ref: { type: Schema.Types.ObjectId, ref: 'Employee' },
      firstName: String,
      lastName: String,
      middleName: String,
      name: String,
      email: String,
      department: String,
      position: String,
      employeeId: String,
    },

    period: {
      month: { type: Number, required: true },
      year: { type: Number, required: true },
    },

    earnings: {
      basicSalary: { type: Number, default: 0 },
      allowances: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      overtime: { type: Number, default: 0 },
    },

    deductions: {
      tax: { type: Number, default: 0 },
      insurance: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },

    netSalary: { type: Number, required: true },

    notes: { type: String, default: '' },

    status: {
      type: String,
      enum: ['draft', 'sent', 'pending_signature', 'signed', 'completed'],
      default: 'draft',
    },

    deliveryChannel: {
      type: String,
      enum: ['email', 'whatsapp'],
      default: 'email',
    },

    emailStatus: {
      type: String,
      enum: ['not_requested', 'queued', 'sent', 'failed'],
      default: 'not_requested',
    },
    emailError: String,
    emailQueuedAt: Date,
    emailSentAt: Date,
    emailFailedAt: Date,

    sentAt: Date,
    viewedAt: Date,
    signedAt: Date,
    lastActivityAt: Date,

    signatureData: String,
    signatureToken: String,
    signatureTokenExpiresAt: { type: Date, default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) }, // 48 hours from creation
    signatureTokenUsed: { type: Boolean, default: false },

    pdfPath: String,
    gcsUrl: String,
    gcsFileName: String,

    pdfUrl: String,
    pdfPublicId: String,
    pdfAssetId: String,
    pdfFormat: String,
    pdfFolder: String,
    pdfFileName: String,
    storageProvider: String,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByRole: { type: String, enum: ['admin', 'manager', 'staff'] },
    approvalStatus: { 
      type: String, 
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required'
    },
    approvalRequestedAt: Date,
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    requestedChannel: { type: String, enum: ['email', 'whatsapp'] },
    sendAfterApproval: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * Auto-generate slipId
 */
salarySlipSchema.pre('save', function (next) {
  if (!this.slipId) {
    this.slipId = uuidv4();
  }
  next();
});

/**
 * Export Model
 */
export const SalarySlip = mongoose.model<ISalarySlip>(
  'SalarySlip',
  salarySlipSchema
);