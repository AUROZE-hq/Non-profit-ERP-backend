import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IAnonymousFeedbackForm extends Document {
  eventTitle?: string;
  eventDate: Date;
  eventId?: Types.ObjectId;

  templateId: Types.ObjectId;
  templateName: string;
  templateSnapshot: {
    templateName: string;
    sections: any[];
  };

  adminNote?: string;
  token: string;
  isActive: boolean;
  
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const anonymousFeedbackFormSchema = new Schema<IAnonymousFeedbackForm>(
  {
    eventTitle: { type: String },
    eventDate: { type: Date, required: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },

    templateId: { type: Schema.Types.ObjectId, ref: 'FeedbackTemplate', required: true },
    templateName: { type: String, required: true },
    templateSnapshot: {
      templateName: { type: String },
      sections: [{ type: Schema.Types.Mixed }],
    },

    adminNote: { type: String },
    token: { type: String, unique: true },
    isActive: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

anonymousFeedbackFormSchema.pre('save', function (next) {
  if (!this.token) {
    this.token = uuidv4();
  }
  next();
});

export const AnonymousFeedbackForm = mongoose.model<IAnonymousFeedbackForm>(
  'AnonymousFeedbackForm',
  anonymousFeedbackFormSchema
);
