import Wishlist from './wishlist.model.js';

export class WishlistRepository {
  async findById(id) {
    return Wishlist.findById(id);
  }

  async findAll() {
    return Wishlist.find();
  }

  async create(data) {
    return Wishlist.create(data);
  }
}

export default new WishlistRepository();
