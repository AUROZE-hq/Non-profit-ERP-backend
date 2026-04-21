import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFeedbackTemplate extends Document {
  templateName: string;
  isActive: boolean;
  sections: Array<{
    id: string;
    type: 'agree_disagree_group' | 'text_answer' | 'custom_checkbox';
    order: number;
    mainQuestion?: string;
    questionText?: string;
    optionSet?: string[];
    subQuestions?: string[];
    selectionMode?: 'single' | 'multiple';
    checkboxOptions?: string[];
  }>;
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

const FeedbackTemplateSchema: Schema = new Schema(
  {
    templateName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    sections: [
      {
        id: { type: String, required: true },
        type: {
          type: String,
          enum: ['agree_disagree_group', 'text_answer', 'custom_checkbox'],
          required: true,
        },
        order: { type: Number, required: true },
        mainQuestion: { type: String },
        questionText: { type: String },
        optionSet: [{ type: String }],
        subQuestions: [{ type: String }],
        selectionMode: { type: String, enum: ['single', 'multiple'] },
        checkboxOptions: [{ type: String }],
      },
    ],
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

export const FeedbackTemplate = mongoose.model<IFeedbackTemplate>(
  'FeedbackTemplate',
  FeedbackTemplateSchema
);
