import mongoose from 'mongoose';

const loginAuditSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
    },
    email: {
      type: String,
      required: [true, 'Attempted email is required'],
      trim: true,
      lowercase: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      required: true,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const LoginAudit = mongoose.models.LoginAudit || mongoose.model('LoginAudit', loginAuditSchema);
export default LoginAudit;
