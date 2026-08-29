import Suppliers from './suppliers.model.js';

export class SuppliersRepository {
  async findById(id) {
    return Suppliers.findById(id);
  }

  async findAll() {
    return Suppliers.find();
  }

  async create(data) {
    return Suppliers.create(data);
  }
}

export default new SuppliersRepository();
