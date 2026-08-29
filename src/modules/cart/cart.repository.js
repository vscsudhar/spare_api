import Cart from './cart.model.js';

export class CartRepository {
  async findById(id) {
    return Cart.findById(id);
  }

  async findAll() {
    return Cart.find();
  }

  async create(data) {
    return Cart.create(data);
  }
}

export default new CartRepository();
