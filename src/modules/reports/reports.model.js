import mongoose from 'mongoose';

const reportsSchema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const Reports = mongoose.models.Reports || mongoose.model('Reports', reportsSchema);
export default Reports;
