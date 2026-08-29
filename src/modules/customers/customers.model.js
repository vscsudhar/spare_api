import mongoose from 'mongoose';

const customersSchema = new mongoose.Schema(
  {
    // TODO: Define schema fields matching Flutter VoltSpare models
  },
  {
    timestamps: true,
  }
);

export const Customers = mongoose.models.Customers || mongoose.model('Customers', customersSchema);
export default Customers;
