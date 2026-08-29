import Products from './products.model.js';

export class ProductsRepository {
  async findById(id) {
    return Products.findById(id);
  }

  async findAll() {
    return Products.find();
  }

  async create(data) {
    return Products.create(data);
  }
}

export default new ProductsRepository();
