import Purchases from './purchases.model.js';

export class PurchasesRepository {
  async findById(id) {
    return Purchases.findById(id);
  }

  async findAll() {
    return Purchases.find();
  }

  async create(data) {
    return Purchases.create(data);
  }
}

export default new PurchasesRepository();
