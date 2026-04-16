import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISuggestion extends Document {
  comment: string;
  targetUrl?: string;
  screenshotPath?: string;
  screenshotOriginalName?: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdByEmail: string;
  createdByRole: string;
  createdAt: Date;
  updatedAt: Date;
}

const suggestionSchema = new Schema<ISuggestion>(
  {
    comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 2000 },
    targetUrl: { type: String, trim: true, maxlength: 1000 },
    screenshotPath: { type: String },
    screenshotOriginalName: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true, trim: true },
    createdByEmail: { type: String, required: true, trim: true, lowercase: true },
    createdByRole: { type: String, required: true, trim: true, lowercase: true },
  },
  { timestamps: true }
);

suggestionSchema.index({ createdAt: -1 });
suggestionSchema.index({ createdBy: 1, createdAt: -1 });

export const Suggestion = mongoose.model<ISuggestion>('Suggestion', suggestionSchema);