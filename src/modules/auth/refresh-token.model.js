import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: [true, 'Refresh token is required'],
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
    isRevoked: {
      type: Boolean,
      default: false,
    },
    replacedByToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.methods.isExpired = function () {
  return Date.now() >= this.expiresAt;
};

refreshTokenSchema.methods.isValid = function () {
  return !this.isRevoked && !this.isExpired();
};

export const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
