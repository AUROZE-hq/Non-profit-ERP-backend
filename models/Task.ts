import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'follow_up';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dueDate: string;
  dueTime: string;
  followUpDate?: string;
  linkedRecord?: string;
  tags: string[];
  attachments: string[];
  notes: string;
  emailNotificationEnabled: boolean;
  inAppNotificationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    assignedTo: { type: String, required: true },
    assignedBy: { type: String, required: true },
    category: { type: String, default: 'General' },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue', 'follow_up'],
      default: 'pending'
    },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    dueTime: { type: String, default: '' },
    followUpDate: { type: String },
    linkedRecord: { type: String },
    tags: { type: [String], default: [] },
    attachments: { type: [String], default: [] },
    notes: { type: String, default: '' },
    emailNotificationEnabled: { type: Boolean, default: false },
    inAppNotificationEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Ensure that we serialize the _id to id so it matches the frontend Task object
TaskSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Task = mongoose.model<ITask>('Task', TaskSchema);
