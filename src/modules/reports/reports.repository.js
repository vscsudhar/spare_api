import Reports from './reports.model.js';

export class ReportsRepository {
  async findById(id) {
    return Reports.findById(id);
  }

  async findAll() {
    return Reports.find();
  }

  async create(data) {
    return Reports.create(data);
  }
}

export default new ReportsRepository();
