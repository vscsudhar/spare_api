import Orders from './orders.model.js';

export class OrdersRepository {
  async findById(id) {
    return Orders.findById(id);
  }

  async findAll() {
    return Orders.find();
  }

  async create(data) {
    return Orders.create(data);
  }
}

export default new OrdersRepository();
