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
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
    },
    firebaseUid: {
      type: String,
      default: null,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    profileImage: {
      type: String,
      default: '',
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    businessName: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    shift: {
      type: String,
      default: '09:00 AM - 06:00 PM',
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

// Compound unique indexes: Email and phone are unique per role (customers separate from staff/users)
userSchema.index({ email: 1, role: 1 }, { unique: true });
userSchema.index(
  { phone: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string', $gt: '' } },
  }
);
userSchema.index(
  { firebaseUid: 1 },
  {
    unique: true,
    partialFilterExpression: { firebaseUid: { $type: 'string', $gt: '' } },
  }
);

// Method to verify password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
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
