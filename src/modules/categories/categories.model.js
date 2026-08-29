import mongoose from 'mongoose';

const categoriesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Categories',
      default: null,
    },
    type: {
      type: String,
      enum: ['EV', 'Petrol', 'Universal'],
      required: true,
      default: 'Universal',
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Categories =
  mongoose.models.Categories || mongoose.model('Categories', categoriesSchema);
export default Categories;
