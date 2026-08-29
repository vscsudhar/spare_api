import uploadsRepository from './uploads.repository.js';

export class UploadsService {
  async getById(id) {
    return uploadsRepository.findById(id);
  }

  async getAll() {
    return uploadsRepository.findAll();
  }
}

export default new UploadsService();
