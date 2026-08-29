import Users from './users.model.js';

export class UsersRepository {
  async findById(id) {
    return Users.findById(id);
  }

  async findAll() {
    return Users.find();
  }

  async create(data) {
    return Users.create(data);
  }
}

export default new UsersRepository();
