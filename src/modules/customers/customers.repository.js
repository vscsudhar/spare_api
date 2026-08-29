import Customers from './customers.model.js';

export class CustomersRepository {
  async findById(id) {
    return Customers.findById(id);
  }

  async findAll() {
    return Customers.find();
  }

  async create(data) {
    return Customers.create(data);
  }
}

export default new CustomersRepository();
