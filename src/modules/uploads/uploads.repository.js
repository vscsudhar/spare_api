import Uploads from './uploads.model.js';

export class UploadsRepository {
  async findById(id) {
    return Uploads.findById(id);
  }

  async findAll() {
    return Uploads.find();
  }

  async create(data) {
    return Uploads.create(data);
  }
}

export default new UploadsRepository();
