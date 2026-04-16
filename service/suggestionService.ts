import { Suggestion, ISuggestion } from '../models/Suggestion';

export type SuggestionView = {
  _id: string;
  comment: string;
  targetUrl?: string;
  hasScreenshot: boolean;
  createdByName: string;
  createdByEmail: string;
  createdByRole: string;
  createdAt: Date;
  updatedAt: Date;
};

function toSuggestionView(record: any): SuggestionView {
  return {
    _id: String(record._id),
    comment: record.comment,
    targetUrl: record.targetUrl,
    hasScreenshot: Boolean(record.screenshotPath),
    createdByName: record.createdByName,
    createdByEmail: record.createdByEmail,
    createdByRole: record.createdByRole,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const suggestionService = {
  async createSuggestion(data: Partial<ISuggestion>): Promise<ISuggestion> {
    const suggestion = new Suggestion(data);
    return suggestion.save();
  },

  async getAllSuggestions(): Promise<SuggestionView[]> {
    const suggestions = await Suggestion.find().sort({ createdAt: -1 }).lean();
    return suggestions.map(toSuggestionView);
  },

  async getSuggestionsByUser(userId: string): Promise<SuggestionView[]> {
    const suggestions = await Suggestion.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();
    return suggestions.map(toSuggestionView);
  },

  async getSuggestionById(suggestionId: string) {
    return Suggestion.findById(suggestionId).exec();
  },
};