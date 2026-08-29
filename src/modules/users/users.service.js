import bcrypt from 'bcryptjs';
import AppError from '../../errors/AppError.js';
import Users from './users.model.js';
import Role from './roles.model.js';
import Permission from './permissions.model.js';

export const usersService = {
  /**
   * Helper to retrieve customer role ID
   */
  getCustomerRoleId: async () => {
    const customerRole = await Role.findOne({ name: 'customer' });
    return customerRole ? customerRole._id : null;
  },

  /**
   * Get all staff users (role != customer)
   */
  getAllStaff: async () => {
    const customerRoleId = await usersService.getCustomerRoleId();
    if (!customerRoleId) {
      throw new AppError('Customer role not seeded.', 500);
    }

    return Users.find({ role: { $ne: customerRoleId } })
      .populate({
        path: 'role',
        populate: {
          path: 'permissions',
          model: 'Permission',
        },
      })
      .populate('permissions');
  },

  /**
   * Create a new staff user
   */
  createStaff: async (staffData) => {
    // Check email/phone uniqueness
    const emailTaken = await Users.findOne({ email: staffData.email, includeDeleted: true });
    if (emailTaken) {
      throw new AppError('Email is already registered.', 400);
    }

    const phoneTaken = await Users.findOne({ phone: staffData.phone, includeDeleted: true });
    if (phoneTaken) {
      throw new AppError('Phone number is already registered.', 400);
    }

    // Verify role exists and is not 'customer'
    const role = await Role.findById(staffData.role);
    if (!role) {
      throw new AppError('Role not found.', 404);
    }
    if (role.name === 'customer') {
      throw new AppError('Cannot create a staff user with customer role.', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(staffData.password, 10);

    const newUser = await Users.create({
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone,
      passwordHash,
      role: staffData.role,
      permissions: staffData.permissions || [],
      status: staffData.status || 'active',
    });

    const populatedUser = await Users.findById(newUser._id).populate('role').populate('permissions');
    return populatedUser;
  },

  /**
   * Get staff user by ID
   */
  getStaffById: async (id) => {
    const customerRoleId = await usersService.getCustomerRoleId();
    const user = await Users.findOne({ _id: id, role: { $ne: customerRoleId } })
      .populate({
        path: 'role',
        populate: {
          path: 'permissions',
          model: 'Permission',
        },
      })
      .populate('permissions');

    if (!user) {
      throw new AppError('Staff user not found.', 404);
    }

    return user;
  },

  /**
   * Update staff basic information
   */
  updateStaff: async (id, updateData) => {
    const user = await usersService.getStaffById(id);

    // Verify uniqueness of email and phone if they are changing
    if (updateData.email && updateData.email !== user.email) {
      const emailTaken = await Users.findOne({ email: updateData.email, includeDeleted: true });
      if (emailTaken) {
        throw new AppError('Email is already registered.', 400);
      }
      user.email = updateData.email;
    }

    if (updateData.phone && updateData.phone !== user.phone) {
      const phoneTaken = await Users.findOne({ phone: updateData.phone, includeDeleted: true });
      if (phoneTaken) {
        throw new AppError('Phone number is already registered.', 400);
      }
      user.phone = updateData.phone;
    }

    if (updateData.name) {
      user.name = updateData.name;
    }

    if (updateData.profileImage !== undefined) {
      user.profileImage = updateData.profileImage;
    }

    await user.save();

    // Re-populate and return
    return usersService.getStaffById(id);
  },

  /**
   * Update staff status (active / disabled / suspended)
   */
  updateStaffStatus: async (id, status) => {
    const user = await usersService.getStaffById(id);
    user.status = status;
    await user.save();
    return user;
  },

  /**
   * Update staff role and permission overrides
   */
  updateStaffRole: async (id, roleId, permissions) => {
    const user = await usersService.getStaffById(id);

    const role = await Role.findById(roleId);
    if (!role) {
      throw new AppError('Role not found.', 404);
    }
    if (role.name === 'customer') {
      throw new AppError('Cannot assign customer role to staff.', 400);
    }

    user.role = roleId;
    if (permissions !== undefined) {
      user.permissions = permissions;
    }

    await user.save();
    return usersService.getStaffById(id);
  },

  /**
   * Soft delete staff user
   */
  deleteStaff: async (id) => {
    const user = await usersService.getStaffById(id);
    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();
  },

  /**
   * Get all roles
   */
  getAllRoles: async () => {
    return Role.find().populate('permissions');
  },

  /**
   * Create new Role
   */
  createRole: async (roleData) => {
    const roleExists = await Role.findOne({ name: roleData.name.toLowerCase() });
    if (roleExists) {
      throw new AppError('Role with this name already exists.', 400);
    }

    const newRole = await Role.create({
      name: roleData.name.toLowerCase(),
      description: roleData.description,
      permissions: roleData.permissions || [],
    });

    return Role.findById(newRole._id).populate('permissions');
  },

  /**
   * Update Role
   */
  updateRole: async (id, updateData) => {
    const role = await Role.findById(id);
    if (!role) {
      throw new AppError('Role not found.', 404);
    }

    if (updateData.name && updateData.name.toLowerCase() !== role.name) {
      const nameExists = await Role.findOne({ name: updateData.name.toLowerCase() });
      if (nameExists) {
        throw new AppError('Role with this name already exists.', 400);
      }
      role.name = updateData.name.toLowerCase();
    }

    if (updateData.description !== undefined) {
      role.description = updateData.description;
    }

    if (updateData.permissions !== undefined) {
      role.permissions = updateData.permissions;
    }

    await role.save();
    return Role.findById(role._id).populate('permissions');
  },

  /**
   * Get all permissions
   */
  getAllPermissions: async () => {
    return Permission.find();
  },

  /**
   * Get user profile details
   */
  getProfile: async (userId) => {
    const user = await Users.findById(userId).populate('role');
    if (!user) {
      throw new AppError('User profile not found.', 404);
    }
    return user;
  },

  /**
   * Update own user profile
   */
  updateProfile: async (userId, updateData) => {
    const user = await Users.findById(userId);
    if (!user) {
      throw new AppError('User profile not found.', 404);
    }

    if (updateData.name !== undefined) {
      user.name = updateData.name;
    }

    if (updateData.email !== undefined) {
      if (updateData.email.toLowerCase() !== user.email.toLowerCase()) {
        const emailExists = await Users.findOne({ email: updateData.email.toLowerCase() });
        if (emailExists) {
          throw new AppError('Email address is already in use.', 400);
        }
        user.email = updateData.email.toLowerCase();
        user.emailVerified = false;
      }
    }

    if (updateData.phone !== undefined) {
      if (updateData.phone !== user.phone) {
        const phoneExists = await Users.findOne({ phone: updateData.phone });
        if (phoneExists) {
          throw new AppError('Phone number is already in use.', 400);
        }
        user.phone = updateData.phone;
        user.phoneVerified = false;
      }
    }

    if (updateData.profileImage !== undefined) {
      user.profileImage = updateData.profileImage;
    }

    await user.save();
    return Users.findById(userId).populate('role');
  },
};

export default usersService;
