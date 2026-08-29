import mongoose from 'mongoose';

const uploadsSchema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const Uploads = mongoose.models.Uploads || mongoose.model('Uploads', uploadsSchema);
export default Uploads;
