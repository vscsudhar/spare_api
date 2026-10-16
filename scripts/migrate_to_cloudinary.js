import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import env from '../src/config/env.js';
import Products from '../src/modules/products/products.model.js';
import RareProductRequest, { RareChatMessage } from '../src/modules/rare-requests/rare-requests.model.js';
import { generatePublicId } from '../src/utils/storage.js';

// Configure Cloudinary
if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
  console.error('❌ Cloudinary environment variables are missing. Please configure .env first.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadsDir = path.join(process.cwd(), 'uploads');

async function migrateFile(filePath, folder, prefix) {
  if (!fs.existsSync(filePath)) {
    return { success: false, reason: 'File does not exist on disk: ' + filePath };
  }

  const publicId = generatePublicId(prefix);
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type: 'image',
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

function extractLocalFilename(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('/uploads/')) return null;
  const parts = url.split('/uploads/');
  return parts[parts.length - 1].split('?')[0];
}

async function runMigration() {
  console.log('🚀 Starting VoltSpare Cloudinary Image Migration...');
  console.log('📡 Connecting to MongoDB:', env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  const stats = {
    products: { total: 0, migrated: 0, skipped: 0, failed: 0 },
    rareRequests: { total: 0, migrated: 0, skipped: 0, failed: 0 },
    chatMessages: { total: 0, migrated: 0, skipped: 0, failed: 0 },
  };

  // 1. Migrate Products
  console.log('\n📦 Checking Products...');
  const products = await Products.find({});
  stats.products.total = products.length;

  for (const product of products) {
    let modified = false;
    if (product.images && Array.isArray(product.images)) {
      for (const img of product.images) {
        if (img.url && !img.url.includes('res.cloudinary.com')) {
          const filename = extractLocalFilename(img.url);
          if (filename) {
            const localPath = path.join(uploadsDir, filename);
            const res = await migrateFile(localPath, 'voltspare/products', 'prod_migrated');
            if (res.success) {
              img.url = res.url;
              img.publicId = res.publicId;
              modified = true;
              stats.products.migrated++;
              console.log(`  ✓ Product "${product.name}" image migrated -> ${res.url}`);
            } else {
              stats.products.failed++;
              console.warn(`  ⚠ Product "${product.name}" image migration failed: ${res.reason}`);
            }
          } else {
            stats.products.skipped++;
          }
        } else {
          stats.products.skipped++;
        }
      }
    }
    if (modified) {
      await product.save();
    }
  }

  // 2. Migrate Rare Requests Images
  console.log('\n🔍 Checking Rare Product Requests...');
  const rareRequests = await RareProductRequest.find({});
  stats.rareRequests.total = rareRequests.length;

  for (const req of rareRequests) {
    let modified = false;
    if (req.images && Array.isArray(req.images)) {
      for (const img of req.images) {
        if (img.url && !img.url.includes('res.cloudinary.com')) {
          const filename = extractLocalFilename(img.url);
          if (filename) {
            const localPath = path.join(uploadsDir, filename);
            const res = await migrateFile(localPath, 'voltspare/chat', 'chat_migrated');
            if (res.success) {
              img.url = res.url;
              img.publicId = res.publicId;
              modified = true;
              stats.rareRequests.migrated++;
              console.log(`  ✓ Rare Request "${req.title}" image migrated -> ${res.url}`);
            } else {
              stats.rareRequests.failed++;
              console.warn(`  ⚠ Rare Request "${req.title}" migration failed: ${res.reason}`);
            }
          } else {
            stats.rareRequests.skipped++;
          }
        } else {
          stats.rareRequests.skipped++;
        }
      }
    }
    if (modified) {
      await req.save();
    }
  }

  // 3. Migrate Rare Chat Messages
  console.log('\n💬 Checking Rare Chat Messages...');
  const chatMessages = await RareChatMessage.find({
    $or: [{ messageType: 'image' }, { imageUrl: { $ne: '' } }],
  });
  stats.chatMessages.total = chatMessages.length;

  for (const msg of chatMessages) {
    if (msg.imageUrl && !msg.imageUrl.includes('res.cloudinary.com')) {
      const filename = extractLocalFilename(msg.imageUrl);
      if (filename) {
        const localPath = path.join(uploadsDir, filename);
        const res = await migrateFile(localPath, 'voltspare/chat', 'chat_migrated');
        if (res.success) {
          msg.imageUrl = res.url;
          msg.publicId = res.publicId;
          await msg.save();
          stats.chatMessages.migrated++;
          console.log(`  ✓ Chat message image migrated -> ${res.url}`);
        } else {
          stats.chatMessages.failed++;
          console.warn(`  ⚠ Chat message image migration failed: ${res.reason}`);
        }
      } else {
        stats.chatMessages.skipped++;
      }
    } else {
      stats.chatMessages.skipped++;
    }
  }

  console.log('\n========================================');
  console.log('🎉 Cloudinary Migration Run Complete!');
  console.log('========================================');
  console.log('Products:     ', stats.products);
  console.log('Rare Requests:', stats.rareRequests);
  console.log('Chat Messages:', stats.chatMessages);
  console.log('Note: Local files in uploads/ were preserved safely.');
  console.log('========================================');

  await mongoose.disconnect();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
