import chatRepository from './chat.repository.js';

export class ChatService {
  async getById(id) {
    return chatRepository.findById(id);
  }

  async getAll() {
    return chatRepository.findAll();
  }
}

export default new ChatService();
