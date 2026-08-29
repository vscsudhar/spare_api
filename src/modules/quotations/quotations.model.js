import mongoose from 'mongoose';

const quotationsSchema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const Quotations =
  mongoose.models.Quotations || mongoose.model('Quotations', quotationsSchema);
export default Quotations;
