import quotationsRepository from './quotations.repository.js';

export class QuotationsService {
  async getById(id) {
    return quotationsRepository.findById(id);
  }

  async getAll() {
    return quotationsRepository.findAll();
  }
}

export default new QuotationsService();
