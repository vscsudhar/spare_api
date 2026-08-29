import Settings from './settings.model.js';

export class SettingsRepository {
  async findById(id) {
    return Settings.findById(id);
  }

  async findAll() {
    return Settings.find();
  }

  async create(data) {
    return Settings.create(data);
  }
}

export default new SettingsRepository();
