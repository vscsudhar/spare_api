import Inventory from './inventory.model.js';

export class InventoryRepository {
  async findById(id) {
    return Inventory.findById(id);
  }

  async findAll() {
    return Inventory.find();
  }

  async create(data) {
    return Inventory.create(data);
  }
}

export default new InventoryRepository();
