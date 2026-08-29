import AppError from '../../errors/AppError.js';
import Categories from './categories.model.js';

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

export const categoriesService = {
  /**
   * Get all categories with optional filters
   */
  getAll: async (filter = {}) => {
    const query = {};

    if (filter.type) {
      // If filtering by EV/Petrol, also return Universal categories
      if (filter.type !== 'Universal') {
        query.type = { $in: [filter.type, 'Universal'] };
      } else {
        query.type = 'Universal';
      }
    }

    if (filter.active !== undefined) {
      query.active = filter.active === 'true' || filter.active === true;
    }

    return Categories.find(query).populate('parentCategory');
  },

  /**
   * Create new Category
   */
  create: async (data) => {
    const slug = slugify(data.name);

    const exists = await Categories.findOne({ $or: [{ name: data.name }, { slug }] });
    if (exists) {
      throw new AppError('Category with this name or slug already exists.', 400);
    }

    if (data.parentCategory) {
      const parent = await Categories.findById(data.parentCategory);
      if (!parent) {
        throw new AppError('Parent category not found.', 404);
      }
    }

    return Categories.create({
      ...data,
      slug,
    });
  },

  /**
   * Update Category
   */
  update: async (id, data) => {
    const category = await Categories.findById(id);
    if (!category) {
      throw new AppError('Category not found.', 404);
    }

    if (data.name && data.name !== category.name) {
      const slug = slugify(data.name);
      const exists = await Categories.findOne({
        _id: { $ne: id },
        $or: [{ name: data.name }, { slug }],
      });
      if (exists) {
        throw new AppError('Category with this name or slug already exists.', 400);
      }
      category.name = data.name;
      category.slug = slug;
    }

    if (data.description !== undefined) category.description = data.description;
    if (data.type !== undefined) category.type = data.type;
    if (data.active !== undefined) category.active = data.active;

    if (data.parentCategory !== undefined) {
      if (data.parentCategory === id) {
        throw new AppError('Category cannot be its own parent.', 400);
      }
      if (data.parentCategory) {
        const parent = await Categories.findById(data.parentCategory);
        if (!parent) {
          throw new AppError('Parent category not found.', 404);
        }
      }
      category.parentCategory = data.parentCategory;
    }

    return category.save();
  },
};

export default categoriesService;
