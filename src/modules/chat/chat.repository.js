import Chat from './chat.model.js';

export class ChatRepository {
  async findById(id) {
    return Chat.findById(id);
  }

  async findAll() {
    return Chat.find();
  }

  async create(data) {
    return Chat.create(data);
  }
}

export default new ChatRepository();
