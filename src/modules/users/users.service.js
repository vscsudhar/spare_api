import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
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
   * Get all staff users (role != customer) with optional location filtering
   */
  getAllStaff: async (query = {}) => {
    const customerRoleId = await usersService.getCustomerRoleId();
    if (!customerRoleId) {
      throw new AppError('Customer role not seeded.', 500);
    }

    const filter = { role: { $ne: customerRoleId } };
    if (query.locationId && query.locationId !== 'All' && query.locationId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(query.locationId)) {
        filter.locationId = query.locationId;
      }
    }

    return Users.find(filter)
      .populate({
        path: 'role',
        populate: {
          path: 'permissions',
          model: 'Permission',
        },
      })
      .populate('locationId')
      .populate('permissions');
  },

  /**
   * Create a new staff user
   */
  createStaff: async (staffData) => {
    const emailClean = (staffData.email || '').trim().toLowerCase();
    if (!emailClean) {
      throw new AppError('Email is required.', 400);
    }

    // Check email uniqueness
    const emailTaken = await Users.findOne({ email: emailClean, includeDeleted: true });
    if (emailTaken) {
      throw new AppError('Email is already registered.', 400);
    }

    let phone = (staffData.phone || '').trim();
    if (!phone) {
      phone = '+91' + Math.floor(6000000000 + Math.random() * 3999999999);
    }
    const phoneTaken = await Users.findOne({ phone, includeDeleted: true });
    if (phoneTaken) {
      phone = '+91' + Math.floor(6000000000 + Math.random() * 3999999999);
    }

    // Resolve Role
    let roleDoc;
    if (staffData.role && mongoose.Types.ObjectId.isValid(staffData.role)) {
      roleDoc = await Role.findById(staffData.role);
    }
    if (!roleDoc && typeof staffData.role === 'string') {
      const rName = staffData.role.toLowerCase();
      if (rName.includes('inventory')) roleDoc = await Role.findOne({ name: 'inventory_staff' });
      else if (rName.includes('sales')) roleDoc = await Role.findOne({ name: 'sales_staff' });
      else if (rName.includes('delivery')) roleDoc = await Role.findOne({ name: 'delivery_staff' });
      else if (rName.includes('owner')) roleDoc = await Role.findOne({ name: 'owner' });
      else if (rName.includes('admin') || rName.includes('manager')) roleDoc = await Role.findOne({ name: 'admin' });
      
      if (!roleDoc) {
        roleDoc = await Role.findOne({ name: rName });
      }
    }
    if (!roleDoc) {
      roleDoc = await Role.findOne({ name: 'admin' }) || await Role.findOne({ name: 'inventory_staff' });
    }

    const password = staffData.password || 'Staff12345!';
    const passwordHash = await bcrypt.hash(password, 10);

    let locationId = staffData.locationId;
    if (locationId === 'all' || !locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      locationId = null;
    }

    const newUser = await Users.create({
      name: staffData.name,
      email: emailClean,
      phone: phone,
      passwordHash,
      role: roleDoc ? roleDoc._id : undefined,
      locationId: locationId,
      shift: staffData.shift || '09:00 AM - 06:00 PM',
      permissions: staffData.permissions || [],
      status: staffData.status || 'active',
      emailVerified: true,
      phoneVerified: true,
    });

    return Users.findById(newUser._id).populate('role').populate('locationId').populate('permissions');
  },

  /**
   * Get staff user by ID
   */
  getStaffById: async (id) => {
    const customerRoleId = await usersService.getCustomerRoleId();
    const user = await Users.findOne({ _id: id, role: { $ne: customerRoleId } })
      .select('+passwordHash')
      .populate({
        path: 'role',
        populate: {
          path: 'permissions',
          model: 'Permission',
        },
      })
      .populate('locationId')
      .populate('permissions');

    if (!user) {
      throw new AppError('Staff user not found.', 404);
    }

    return user;
  },

  /**
   * Update staff basic information, password, location, shift, status
   */
  updateStaff: async (id, updateData) => {
    const user = await usersService.getStaffById(id);

    if (updateData.email && updateData.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const newEmail = updateData.email.trim().toLowerCase();
      const emailTaken = await Users.findOne({ email: newEmail, includeDeleted: true });
      if (emailTaken && emailTaken._id.toString() !== id) {
        throw new AppError('Email is already registered.', 400);
      }
      user.email = newEmail;
    }

    if (updateData.phone && updateData.phone.trim() !== user.phone) {
      const newPhone = updateData.phone.trim();
      const phoneTaken = await Users.findOne({ phone: newPhone, includeDeleted: true });
      if (phoneTaken && phoneTaken._id.toString() !== id) {
        throw new AppError('Phone number is already registered.', 400);
      }
      user.phone = newPhone;
    }

    if (updateData.name) {
      user.name = updateData.name.trim();
    }

    if (updateData.password && updateData.password.trim().length >= 6) {
      user.passwordHash = await bcrypt.hash(updateData.password.trim(), 10);
    }

    if (updateData.role) {
      let roleDoc;
      if (mongoose.Types.ObjectId.isValid(updateData.role)) {
        roleDoc = await Role.findById(updateData.role);
      }
      if (!roleDoc && typeof updateData.role === 'string') {
        const rName = updateData.role.toLowerCase();
        if (rName.includes('inventory')) roleDoc = await Role.findOne({ name: 'inventory_staff' });
        else if (rName.includes('sales')) roleDoc = await Role.findOne({ name: 'sales_staff' });
        else if (rName.includes('delivery')) roleDoc = await Role.findOne({ name: 'delivery_staff' });
        else if (rName.includes('owner')) roleDoc = await Role.findOne({ name: 'owner' });
        else if (rName.includes('admin') || rName.includes('manager')) roleDoc = await Role.findOne({ name: 'admin' });
        if (!roleDoc) {
          roleDoc = await Role.findOne({ name: rName });
        }
      }
      if (roleDoc) {
        user.role = roleDoc._id;
      }
    }

    if (updateData.locationId !== undefined) {
      if (updateData.locationId === 'all' || !updateData.locationId || !mongoose.Types.ObjectId.isValid(updateData.locationId)) {
        user.locationId = null;
      } else {
        user.locationId = updateData.locationId;
      }
    }

    if (updateData.shift) {
      user.shift = updateData.shift;
    }

    if (updateData.status) {
      let st = updateData.status.toLowerCase();
      if (st === 'inactive') st = 'disabled';
      else if (st === 'on leave') st = 'suspended';
      user.status = st;
    }

    if (updateData.profileImage !== undefined) {
      user.profileImage = updateData.profileImage;
    }

    await user.save();
    return usersService.getStaffById(id);
  },

  /**
   * Update staff status
   */
  updateStaffStatus: async (id, status) => {
    const user = await usersService.getStaffById(id);
    let st = (status || '').toLowerCase();
    if (st === 'inactive') st = 'disabled';
    else if (st === 'on leave') st = 'suspended';
    else if (st === 'active') st = 'active';
    user.status = st;
    await user.save();
    return user;
  },

  /**
   * Update staff role
   */
  updateStaffRole: async (id, roleId, permissions) => {
    const user = await usersService.getStaffById(id);
    if (mongoose.Types.ObjectId.isValid(roleId)) {
      user.role = roleId;
    }
    if (permissions !== undefined) {
      user.permissions = permissions;
    }
    await user.save();
    return usersService.getStaffById(id);
  },

  /**
   * Delete staff user
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
    const user = await Users.findById(userId).populate('role').populate('locationId');
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
      const newEmail = updateData.email.trim().toLowerCase();
      if (newEmail !== user.email.toLowerCase()) {
        const emailExists = await Users.findOne({ email: newEmail });
        if (emailExists && emailExists._id.toString() !== userId.toString()) {
          throw new AppError('Email address is already in use.', 400);
        }
        user.email = newEmail;
      }
    }

    if (updateData.phone !== undefined) {
      const newPhone = updateData.phone.trim();
      if (newPhone !== user.phone) {
        const phoneExists = await Users.findOne({ phone: newPhone });
        if (phoneExists && phoneExists._id.toString() !== userId.toString()) {
          throw new AppError('Phone number is already in use.', 400);
        }
        user.phone = newPhone;
      }
    }

    if (updateData.password && updateData.password.trim().length >= 6) {
      user.passwordHash = await bcrypt.hash(updateData.password.trim(), 10);
    }

    if (updateData.profileImage !== undefined) {
      user.profileImage = updateData.profileImage;
    }

    await user.save();
    return Users.findById(userId).populate('role').populate('locationId');
  },
};

export default usersService;
