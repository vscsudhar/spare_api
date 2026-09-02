import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Role is required'],
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'disabled', 'suspended'],
      default: 'active',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
    },
    vehicles: [
      {
        brand: { type: String, required: true },
        name: { type: String, required: true },
        year: { type: String, required: true },
        type: { type: String, enum: ['EV', 'Petrol'], required: true },
      }
    ],
  },
  {
    timestamps: true,
  }
);

// Method to verify password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Query middleware to exclude soft-deleted users by default
userSchema.pre(/^find/, function (next) {
  // If explicitly querying for soft-deleted, bypass
  if (this.getFilter().includeDeleted) {
    delete this.getFilter().includeDeleted;
    return next();
  }
  this.find({ isDeleted: { $ne: true } });
  next();
});

export const Users = mongoose.models.Users || mongoose.model('Users', userSchema);
if (!mongoose.models.User) mongoose.model('User', userSchema);
export default Users;
