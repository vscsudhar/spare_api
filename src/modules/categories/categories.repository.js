import Categories from './categories.model.js';

export class CategoriesRepository {
  async findById(id) {
    return Categories.findById(id);
  }

  async findAll() {
    return Categories.find();
  }

  async create(data) {
    return Categories.create(data);
  }
}

export default new CategoriesRepository();
