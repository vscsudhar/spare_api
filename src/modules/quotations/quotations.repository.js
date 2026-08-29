import Quotations from './quotations.model.js';

export class QuotationsRepository {
  async findById(id) {
    return Quotations.findById(id);
  }

  async findAll() {
    return Quotations.find();
  }

  async create(data) {
    return Quotations.create(data);
  }
}

export default new QuotationsRepository();
