import AppError from '../../errors/AppError.js';
import Users from '../users/users.model.js';
import Role from '../users/roles.model.js';

export const customersService = {
  /**
   * Get logged-in user profile details
   */
  getMe: async (userId) => {
    const user = await Users.findById(userId).populate('role');
    if (!user) {
      throw new AppError('User not found.', 404);
    }
    return user;
  },

  /**
   * Update logged-in user profile details
   */
  updateMe: async (userId, updateData) => {
    const user = await Users.findById(userId);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (updateData.name) user.name = updateData.name;
    if (updateData.profileImage !== undefined) user.profileImage = updateData.profileImage;

    if (updateData.phone && updateData.phone !== user.phone) {
      const phoneExists = await Users.findOne({ phone: updateData.phone });
      if (phoneExists) {
        throw new AppError('Phone number is already in use by another account.', 400);
      }
      user.phone = updateData.phone;
      user.phoneVerified = false; // reset verification
    }

    await user.save();
    return Users.findById(userId).populate('role');
  },

  /**
   * Get all registered customers (staff admin endpoint)
   */
  getAll: async () => {
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      return [];
    }

    return Users.find({ role: customerRole._id }).populate('role');
  },

  /**
   * Get specific customer detail (staff admin endpoint)
   */
  getById: async (id) => {
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      throw new AppError('Role not seeded.', 500);
    }

    const customer = await Users.findOne({ _id: id, role: customerRole._id }).populate('role');
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    return customer;
  },

  /**
   * Update customer status (staff admin endpoint)
   */
  updateStatus: async (id, status) => {
    const customerRole = await Role.findOne({ name: 'customer' });
    if (!customerRole) {
      throw new AppError('Role not seeded.', 500);
    }

    const customer = await Users.findOne({ _id: id, role: customerRole._id });
    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    customer.status = status;
    await customer.save();

    return Users.findById(id).populate('role');
  },

  getVehicles: async (userId) => {
    const user = await Users.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    return user.vehicles || [];
  },

  addVehicle: async (userId, vehicleData) => {
    const user = await Users.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    user.vehicles.push(vehicleData);
    await user.save();
    return user.vehicles[user.vehicles.length - 1];
  },

  updateVehicle: async (userId, vehicleId, vehicleData) => {
    const user = await Users.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    const vehicle = user.vehicles.id(vehicleId);
    if (!vehicle) throw new AppError('Vehicle not found.', 404);
    if (vehicleData.brand) vehicle.brand = vehicleData.brand;
    if (vehicleData.name) vehicle.name = vehicleData.name;
    if (vehicleData.year) vehicle.year = vehicleData.year;
    if (vehicleData.type) vehicle.type = vehicleData.type;
    await user.save();
    return vehicle;
  },

  deleteVehicle: async (userId, vehicleId) => {
    const user = await Users.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    user.vehicles.pull({ _id: vehicleId });
    await user.save();
  },
};

export default customersService;
