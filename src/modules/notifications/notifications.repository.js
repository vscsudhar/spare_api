import Notifications from './notifications.model.js';

export class NotificationsRepository {
  async findById(id) {
    return Notifications.findById(id);
  }

  async findAll() {
    return Notifications.find();
  }

  async create(data) {
    return Notifications.create(data);
  }
}

export default new NotificationsRepository();
