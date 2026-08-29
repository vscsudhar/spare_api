import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: [true, 'Identifier (email/phone) is required'],
      index: true,
    },
    otp: {
      type: String,
      required: [true, 'OTP value is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration time is required'],
      expires: 600, // Expires after 10 minutes automatically in MongoDB TTL
    },
  },
  {
    timestamps: true,
  }
);

export const OTP = mongoose.models.OTP || mongoose.model('OTP', otpSchema);
export default OTP;
