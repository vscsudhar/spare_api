import mongoose from 'mongoose';

const suggestionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    suggestion: {
      type: String,
      required: [true, 'Suggestion text is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending',
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

suggestionSchema.index({ createdAt: -1 });
suggestionSchema.index({ status: 1 });

export const Suggestion =
  mongoose.models.Suggestion || mongoose.model('Suggestion', suggestionSchema);

export default Suggestion;
