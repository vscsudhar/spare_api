import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB, closeDB } from '../config/db.js';
import Permission from '../modules/users/permissions.model.js';
import Role from '../modules/users/roles.model.js';
import Users from '../modules/users/users.model.js';
import Categories from '../modules/categories/categories.model.js';
import Products from '../modules/products/products.model.js';
import { VehicleType, VehicleBrand, VehicleModel } from '../modules/products/catalog.model.js';
import inventoryService from '../modules/inventory/inventory.service.js';
import Coupon from '../modules/cart/coupons.model.js';

const PERMISSIONS = [
  { name: 'dashboard.read', description: 'Access dashboard metrics' },
  { name: 'products.read', description: 'Read products list' },
  { name: 'products.create', description: 'Create new products' },
  { name: 'products.update', description: 'Update products info' },
  { name: 'products.delete', description: 'Soft delete or delete products' },
  { name: 'inventory.read', description: 'Read inventory stock details' },
  { name: 'inventory.update', description: 'Update inventory stock levels' },
  { name: 'orders.read', description: 'Read orders' },
  { name: 'orders.update', description: 'Update order status or assignments' },
  { name: 'billing.create', description: 'Create billing and invoices' },
  { name: 'suppliers.manage', description: 'Manage supplier profiles' },
  { name: 'purchases.manage', description: 'Manage product purchase orders' },
  { name: 'rare_requests.read', description: 'Read rare requests list' },
  { name: 'rare_requests.reply', description: 'Reply to rare requests' },
  { name: 'quotations.create', description: 'Create quotations' },
  { name: 'reports.read', description: 'View financial and operational reports' },
  { name: 'staff.manage', description: 'Create, edit, suspend staff accounts' },
  { name: 'settings.manage', description: 'Manage system settings' },
];

export const seedDatabase = async (disconnectAfter = false) => {
  try {
    console.log('🌱 Starting database seeding...');

    // 1. Seed Permissions
    const permissionDocs = [];
    for (const p of PERMISSIONS) {
      let doc = await Permission.findOne({ name: p.name });
      if (!doc) {
        doc = await Permission.create(p);
        console.log(`🔑 Created Permission: ${p.name}`);
      }
      permissionDocs.push(doc);
    }

    const permissionMap = {};
    permissionDocs.forEach((doc) => {
      permissionMap[doc.name] = doc._id;
    });

    // 2. Define Roles and Roles Map
    const rolesData = [
      {
        name: 'owner',
        description: 'System Owner with full administrative permissions',
        permissions: Object.values(permissionMap), // All permissions
      },
      {
        name: 'admin',
        description: 'Administrator with full operations permissions (except system settings)',
        permissions: Object.keys(permissionMap)
          .filter((p) => p !== 'settings.manage')
          .map((p) => permissionMap[p]),
      },
      {
        name: 'inventory_staff',
        description: 'Inventory Management Staff',
        permissions: [
          'products.read',
          'products.create',
          'products.update',
          'inventory.read',
          'inventory.update',
          'suppliers.manage',
        ].map((p) => permissionMap[p]),
      },
      {
        name: 'sales_staff',
        description: 'Sales and Quotation Management Staff',
        permissions: [
          'dashboard.read',
          'products.read',
          'orders.read',
          'orders.update',
          'billing.create',
          'rare_requests.read',
          'rare_requests.reply',
          'quotations.create',
        ].map((p) => permissionMap[p]),
      },
      {
        name: 'delivery_staff',
        description: 'Delivery Staff and Dispatcher',
        permissions: ['orders.read', 'orders.update'].map((p) => permissionMap[p]),
      },
      {
        name: 'customer',
        description: 'Standard VoltSpare Customer',
        permissions: ['products.read', 'orders.read'].map((p) => permissionMap[p]),
      },
    ];

    const rolesMap = {};
    for (const r of rolesData) {
      let doc = await Role.findOne({ name: r.name });
      if (!doc) {
        doc = await Role.create(r);
        console.log(`🛡️ Created Role: ${r.name}`);
      } else {
        // Update permissions list to ensure they align if changed
        doc.permissions = r.permissions;
        await doc.save();
      }
      rolesMap[r.name] = doc._id;
    }

    // 3. Seed Owner Account
    const ownerEmail = env.OWNER_EMAIL.toLowerCase();
    const ownerExists = await Users.findOne({ email: ownerEmail, includeDeleted: true });
    if (!ownerExists) {
      const passwordHash = await bcrypt.hash(env.OWNER_PASSWORD, 10);
      await Users.create({
        name: env.OWNER_NAME,
        email: ownerEmail,
        phone: env.OWNER_PHONE,
        passwordHash,
        role: rolesMap['owner'],
        permissions: [],
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
      });
      console.log(`👑 Created Owner Account: ${ownerEmail}`);
    } else {
      console.log(`👑 Owner Account already exists: ${ownerEmail}`);
    }

    // Seed Admin Account
    const adminEmail = 'admin@voltspare.com';
    const adminExists = await Users.findOne({ email: adminEmail, includeDeleted: true });
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('AdminPassword123!', 10);
      await Users.create({
        name: 'System Admin',
        email: adminEmail,
        phone: '+1234567899',
        passwordHash,
        role: rolesMap['admin'],
        permissions: [],
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
      });
      console.log(`🛡️ Created Admin Account: ${adminEmail}`);
    } else {
      console.log(`🛡️ Admin Account already exists: ${adminEmail}`);
    }

    // Seed Default Customer Account for Mobile App
    const customerEmail = 'customer.dash@test.com';
    const customerExists = await Users.findOne({ email: customerEmail, includeDeleted: true });
    if (!customerExists) {
      const passwordHash = await bcrypt.hash('P@ssword123!', 10);
      await Users.create({
        name: 'Test Customer',
        email: customerEmail,
        phone: '9876543210',
        passwordHash,
        role: rolesMap['customer'],
        permissions: [],
        status: 'active',
        emailVerified: true,
        phoneVerified: true,
      });
      console.log(`👤 Created Default Customer Account: ${customerEmail}`);
    } else {
      console.log(`👤 Default Customer Account already exists: ${customerEmail}`);
    }

    // 4. Seed Categories
    const categoriesData = [
      { name: 'Engine Spares', slug: 'engine-spares', type: 'Petrol' },
      { name: 'Brakes', slug: 'brakes', type: 'Universal' },
      { name: 'Electrical Spares', slug: 'electrical-spares', type: 'EV' },
      { name: 'Body Parts', slug: 'body-parts', type: 'Universal' },
    ];
    const categoryMap = {};
    for (const cat of categoriesData) {
      let doc = await Categories.findOne({ slug: cat.slug });
      if (!doc) {
        doc = await Categories.create(cat);
        console.log(`📁 Seeded Category: ${cat.name}`);
      }
      categoryMap[cat.name] = doc._id;
    }

    // 5. Seed Vehicle Types
    const vTypes = ['Scooter', 'Motorcycle'];
    const typeMap = {};
    for (const typeName of vTypes) {
      const slug = typeName.toLowerCase();
      let doc = await VehicleType.findOne({ slug });
      if (!doc) {
        doc = await VehicleType.create({ name: typeName, slug });
        console.log(`🛵 Seeded Vehicle Type: ${typeName}`);
      }
      typeMap[typeName] = doc._id;
    }

    // 6. Seed Vehicle Brands
    const brandsData = [
      { name: 'Ather', slug: 'ather', vehicleType: typeMap['Scooter'] },
      { name: 'Ola', slug: 'ola', vehicleType: typeMap['Scooter'] },
      { name: 'Honda', slug: 'honda', vehicleType: typeMap['Scooter'] },
    ];
    const brandMap = {};
    for (const br of brandsData) {
      let doc = await VehicleBrand.findOne({ slug: br.slug });
      if (!doc) {
        doc = await VehicleBrand.create(br);
        console.log(`🏷️ Seeded Vehicle Brand: ${br.name}`);
      }
      brandMap[br.name] = doc._id;
    }

    // 7. Seed Vehicle Models
    const modelsData = [
      { name: 'Ather 450X', slug: 'ather-450x', brand: brandMap['Ather'], type: 'EV', years: ['2021', '2022', '2023', '2024'] },
      { name: 'Ola S1 Pro', slug: 'ola-s1-pro', brand: brandMap['Ola'], type: 'EV', years: ['2022', '2023', '2024'] },
      { name: 'Honda Activa 6G', slug: 'honda-activa-6g', brand: brandMap['Honda'], type: 'Petrol', years: ['2020', '2021', '2022', '2023', '2024'] },
    ];
    const modelMap = {};
    for (const md of modelsData) {
      let doc = await VehicleModel.findOne({ slug: md.slug, brand: md.brand });
      if (!doc) {
        doc = await VehicleModel.create(md);
        console.log(`🏍️ Seeded Vehicle Model: ${md.name}`);
      }
      modelMap[md.name] = doc._id;
    }

    // 8. Seed Products and Inventory
    const productsData = [
      {
        sku: 'ATH-DRV-BLT',
        name: 'Ather Drive Belt',
        slug: 'ather-drive-belt',
        description: 'OEM Ather drive belt for smooth transmission.',
        brand: 'Ather',
        category: categoryMap['Electrical Spares'],
        vehicleType: typeMap['Scooter'],
        sellingPrice: 1500,
        mrp: 1800,
        purchasePrice: 1000,
        compatibilities: [{ brand: brandMap['Ather'], model: modelMap['Ather 450X'], years: ['2022', '2023'] }],
        active: true,
      },
      {
        sku: 'OLA-BRK-PAD',
        name: 'Ola S1 Front Brake Pads',
        slug: 'ola-s1-front-brake-pads',
        description: 'High performance ceramic compound front brake pads for Ola S1.',
        brand: 'Ola',
        category: categoryMap['Brakes'],
        vehicleType: typeMap['Scooter'],
        sellingPrice: 450,
        mrp: 600,
        purchasePrice: 250,
        compatibilities: [{ brand: brandMap['Ola'], model: modelMap['Ola S1 Pro'], years: ['2022', '2023', '2024'] }],
        active: true,
      },
      {
        sku: 'ACT-AIR-FLT',
        name: 'Activa 6G Air Filter',
        slug: 'activa-6g-air-filter',
        description: 'OEM replacement air filter element for Activa 6G.',
        brand: 'Honda',
        category: categoryMap['Engine Spares'],
        vehicleType: typeMap['Scooter'],
        sellingPrice: 250,
        mrp: 350,
        purchasePrice: 150,
        compatibilities: [{ brand: brandMap['Honda'], model: modelMap['Honda Activa 6G'], years: ['2020', '2021', '2022', '2023'] }],
        active: true,
      },
    ];

    for (const prd of productsData) {
      let doc = await Products.findOne({ sku: prd.sku, includeDeleted: true });
      if (!doc) {
        doc = await Products.create(prd);
        console.log(`📦 Seeded Product: ${prd.name}`);

        // Log opening stock in Inventory
        await inventoryService.updateStock(
          doc._id,
          'opening',
          25,
          'Seeder',
          doc._id,
          null,
          'Opening stock seeder mapping'
        );
        console.log(`⚡ Seeded Stock: 25 units of ${prd.name}`);
      }
    }

    // 9. Seed Coupons
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const couponsData = [
      {
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        minPurchaseAmount: 500,
        maxDiscountAmount: 200,
        expiresAt: nextYear,
        active: true,
      },
      {
        code: 'WELCOME100',
        discountType: 'flat',
        discountValue: 100,
        minPurchaseAmount: 1000,
        expiresAt: nextYear,
        active: true,
      },
    ];

    for (const cp of couponsData) {
      let doc = await Coupon.findOne({ code: cp.code });
      if (!doc) {
        await Coupon.create(cp);
        console.log(`🎟️ Seeded Coupon: ${cp.code}`);
      }
    }

    console.log('✅ Seeding completed successfully!');
    if (disconnectAfter) {
      await closeDB();
    }
  } catch (error) {
    console.error(`❌ Seeding failed: ${error.message}`);
    if (disconnectAfter) {
      process.exit(1);
    }
    throw error;
  }
};

// Check if run directly
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  await connectDB();
  await seedDatabase(true);
}
