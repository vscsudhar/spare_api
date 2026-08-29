import Addresses from './addresses.model.js';

export class AddressesRepository {
  async findById(id) {
    return Addresses.findById(id);
  }

  async findAll() {
    return Addresses.find();
  }

  async create(data) {
    return Addresses.create(data);
  }
}

export default new AddressesRepository();
