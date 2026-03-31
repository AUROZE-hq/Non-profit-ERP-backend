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

/**
 * Interface
 */
export interface ISalarySlip extends Document {
  slipId?: string;

  employee: {
    ref?: Types.ObjectId;
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

  sentAt?: Date;
  viewedAt?: Date;
  signedAt?: Date;
  lastActivityAt?: Date;

  signatureData?: string;
  signatureToken?: string;

  pdfPath?: string;
  gcsUrl?: string;
  gcsFileName?: string;

  createdBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Schema
 */
const salarySlipSchema = new Schema<ISalarySlip>(
  {
    slipId: { type: String, unique: true },

    employee: {
      ref: { type: Schema.Types.ObjectId, ref: 'Employee' },
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

    sentAt: Date,
    viewedAt: Date,
    signedAt: Date,
    lastActivityAt: Date,

    signatureData: String,
    signatureToken: String,

    pdfPath: String,
    gcsUrl: String,
    gcsFileName: String,

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
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