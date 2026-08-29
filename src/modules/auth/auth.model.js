import mongoose from 'mongoose';

const authSchema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const Auth = mongoose.models.Auth || mongoose.model('Auth', authSchema);
export default Auth;
