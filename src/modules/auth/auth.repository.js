import Auth from './auth.model.js';

export class AuthRepository {
  async findById(id) {
    return Auth.findById(id);
  }

  async findAll() {
    return Auth.find();
  }

  async create(data) {
    return Auth.create(data);
  }
}

export default new AuthRepository();
