import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import env from '../config/env.js';
import { validateUploadedImage } from './fileValidation.js';
import AppError from '../errors/AppError.js';

// Local temporary uploads directory for Multer disk storage
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, (file.fieldname || 'upload') + '-' + uniqueSuffix + ext);
  },
});

// Multer file filter (MIME type check before receiving stream)
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPG, JPEG, PNG, and WebP images are allowed.', 400), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure Cloudinary from environment variables
const isCloudinaryConfigured = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Configure AWS S3 if enabled
const s3Configured = !!(
  env.AWS_ACCESS_KEY_ID &&
  env.AWS_SECRET_ACCESS_KEY &&
  env.AWS_REGION &&
  env.AWS_S3_BUCKET_NAME
);

let s3Client = null;
if (s3Configured && env.STORAGE_PROVIDER === 's3') {
  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Generate a cryptographically safe public ID for Cloudinary assets.
 * @param {string} prefix 
 * @returns {string}
 */
export const generatePublicId = (prefix = 'asset') => {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${randomHex}`;
};

/**
 * Upload an image to Cloudinary with validation, retry handling, and safe cleanup.
 * @param {Object} file - Express Multer file object
 * @param {Object} options - Upload options { folder, prefix, publicId }
 * @returns {Promise<{url: string, secure_url: string, publicId: string, public_id: string}>}
 */
export const uploadToCloudinary = async (file, options = {}) => {
  // 1. Strict file signature & size validation (magic bytes)
  validateUploadedImage(file);

  const folder = options.folder || 'voltspare/products';
  const prefix = options.prefix || 'prod';
  const publicId = options.publicId || generatePublicId(prefix);

  const uploadOptions = {
    folder,
    public_id: publicId,
    resource_type: 'image',
    overwrite: true,
  };

  let lastError = null;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await cloudinary.uploader.upload(file.path, uploadOptions);

      // Clean up temporary local file immediately on successful Cloudinary upload
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {}
      }

      return {
        url: result.secure_url,
        secure_url: result.secure_url,
        publicId: result.public_id,
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Cloudinary Upload] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  // If Cloudinary failed due to misconfiguration or service issue, fallback safely to local
  console.error('[Cloudinary Upload Error] Final failure after retries:', lastError);

  // If local fallback is needed to avoid breaking the application
  const backendUrl = env.BACKEND_URL || '';
  const fallbackUrl = `${backendUrl}/uploads/${file.filename}`;

  return {
    url: fallbackUrl,
    secure_url: fallbackUrl,
    publicId: null,
    public_id: null,
    fallback: true,
    error: lastError?.message,
  };
};

/**
 * Safely delete an asset from Cloudinary by public ID.
 * @param {string} publicId 
 * @returns {Promise<boolean>}
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId || typeof publicId !== 'string') return false;
  if (!isCloudinaryConfigured) return false;

  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return res.result === 'ok';
  } catch (err) {
    console.error(`[Cloudinary Delete Error] Failed to delete ${publicId}:`, err.message);
    return false;
  }
};

/**
 * Unified file uploader with Cloudinary preference, S3 support, and fallback.
 * @param {Object} file - Express Multer file object
 * @param {Object} [options] - Options { folder, prefix }
 * @returns {Promise<{url: string, secure_url: string, publicId: string, public_id: string}>}
 */
export const uploadFile = async (file, options = {}) => {
  // Ensure genuine file validation
  validateUploadedImage(file);

  // 1. Cloudinary upload (default when STORAGE_PROVIDER is cloudinary or fallback)
  if (isCloudinaryConfigured && env.STORAGE_PROVIDER !== 's3') {
    return uploadToCloudinary(file, options);
  }

  // 2. AWS S3 storage provider
  if (s3Client && env.STORAGE_PROVIDER === 's3') {
    try {
      const fileStream = fs.createReadStream(file.path);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileKey = `products/product-${uniqueSuffix}${path.extname(file.originalname)}`;

      const uploadParams = {
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: fileKey,
        Body: fileStream,
        ContentType: file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {}
      }

      const url = `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${fileKey}`;
      return {
        url,
        secure_url: url,
        publicId: fileKey,
        public_id: fileKey,
      };
    } catch (error) {
      console.error('AWS S3 upload failed, falling back to local storage:', error);
    }
  }

  // 3. Local development storage fallback
  const backendUrl = env.BACKEND_URL || '';
  return {
    url: `${backendUrl}/uploads/${file.filename}`,
    secure_url: `${backendUrl}/uploads/${file.filename}`,
    publicId: null,
    public_id: null,
  };
};

export default upload;
