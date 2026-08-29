import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Permission name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Permission = mongoose.models.Permission || mongoose.model('Permission', permissionSchema);
export default Permission;
