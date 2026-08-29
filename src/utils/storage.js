import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import env from '../config/env.js';

// Initialize local uploads directory
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
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// File validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure Cloudinary if keys are provided
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
  });
}

// Configure AWS S3
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
 * Unified file uploader with S3 support, Cloudinary transition and local fallback.
 * @param {Object} file - Express Multer file object
 * @returns {Promise<{url: string, publicId: string|null}>}
 */
export const uploadFile = async (file) => {
  // S3 storage provider
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

      // Delete temporary local file on success
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      const url = `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${fileKey}`;
      return {
        url,
        publicId: fileKey,
      };
    } catch (error) {
      console.error('AWS S3 upload failed, falling back to local storage:', error);
    }
  }

  // Cloudinary storage provider
  if (isCloudinaryConfigured && env.STORAGE_PROVIDER !== 's3') {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'voltspare/rare-requests',
      });
      // Delete temporary local file on success
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      console.error('Cloudinary upload failed, falling back to local storage:', error);
    }
  }

  // Local development storage fallback URL
  const backendUrl = env.BACKEND_URL || '';
  return {
    url: `${backendUrl}/uploads/${file.filename}`,
    publicId: null,
  };
};

export default upload;