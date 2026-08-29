import Billing from './billing.model.js';

export class BillingRepository {
  async findById(id) {
    return Billing.findById(id);
  }

  async findAll() {
    return Billing.find();
  }

  async create(data) {
    return Billing.create(data);
  }
}

export default new BillingRepository();
