import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.zodSchema
  ? z.zodSchema
  : z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      PORT: z
        .string()
        .transform((val) => parseInt(val, 10))
        .default('5000'),
      API_PREFIX: z.string().default('/api/v1'),
      MONGODB_URI: z
        .string()
        .url()
        .or(z.string().regex(/^mongodb(\+srv)?:\/\/.+/)),
      JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
      JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
      JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
      JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
      CLIENT_URL: z.string().url().default('http://localhost:3000'),
      FLUTTER_WEB_URL: z.string().url().default('http://localhost:50000'),
      CLOUDINARY_CLOUD_NAME: z.string().optional().or(z.literal('')),
      CLOUDINARY_API_KEY: z.string().optional().or(z.literal('')),
      CLOUDINARY_API_SECRET: z.string().optional().or(z.literal('')),
      AWS_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
      AWS_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
      AWS_REGION: z.string().optional().or(z.literal('')),
      AWS_S3_BUCKET_NAME: z.string().optional().or(z.literal('')),
      STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
      BACKEND_URL: z.string().optional().or(z.literal('')),
      OWNER_NAME: z.string().default('System Owner'),
      OWNER_EMAIL: z.string().email('Invalid owner email address'),
      OWNER_PASSWORD: z.string().min(8, 'Owner password must be at least 8 characters long'),
      OWNER_PHONE: z.string().min(1, 'Owner phone is required'),
    });

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment configuration validation failed:');
    result.error.errors.forEach((err) => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export default env;
