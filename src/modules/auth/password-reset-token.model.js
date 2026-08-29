import mongoose from 'mongoose';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, 'Reset token is required'],
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Users',
      required: [true, 'User reference is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
    },
  },
  {
    timestamps: true,
  }
);

passwordResetTokenSchema.methods.isExpired = function () {
  return Date.now() >= this.expiresAt;
};

export const PasswordResetToken =
  mongoose.models.PasswordResetToken || mongoose.model('PasswordResetToken', passwordResetTokenSchema);
export default PasswordResetToken;
