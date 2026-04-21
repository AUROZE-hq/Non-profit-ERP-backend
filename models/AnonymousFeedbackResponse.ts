import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAnonymousFeedbackResponse extends Document {
  formId: Types.ObjectId;
  answers: any; // Keyed by sectionId
  
  pdfUrl?: string;
  pdfPublicId?: string;
  storageProvider?: string;

  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const anonymousFeedbackResponseSchema = new Schema<IAnonymousFeedbackResponse>(
  {
    formId: { type: Schema.Types.ObjectId, ref: 'AnonymousFeedbackForm', required: true },
    answers: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    
    pdfUrl: { type: String },
    pdfPublicId: { type: String },
    storageProvider: { type: String },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const AnonymousFeedbackResponse = mongoose.model<IAnonymousFeedbackResponse>(
  'AnonymousFeedbackResponse',
  anonymousFeedbackResponseSchema
);
