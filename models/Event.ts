import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  eventName: string;
  eventDate: Date;
  additionalNote?: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdByRole: 'admin' | 'manager' | 'staff';
  approvalStatus: 'approved' | 'pending' | 'rejected';
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema: Schema = new Schema(
  {
    eventName: { type: String, required: true },
    eventDate: { type: Date, required: true },
    additionalNote: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, enum: ['admin', 'manager', 'staff'], required: true },
    approvalStatus: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export const Event = mongoose.model<IEvent>('Event', EventSchema);
