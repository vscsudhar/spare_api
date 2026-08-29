import RareRequests from './rare-requests.model.js';

export class RareRequestsRepository {
  async findById(id) {
    return RareRequests.findById(id);
  }

  async findAll() {
    return RareRequests.find();
  }

  async create(data) {
    return RareRequests.create(data);
  }
}

export default new RareRequestsRepository();
