import AppError from '../errors/AppError.js';
import fs from 'fs';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Inspect buffer magic numbers to verify genuine image content.
 * @param {Buffer} buffer 
 * @returns {'jpeg'|'png'|'webp'|null}
 */
export const detectImageSignature = (buffer) => {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'png';
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50    // P
  ) {
    return 'webp';
  }

  return null;
};

/**
 * Validate Multer uploaded file for size, signature, and format.
 * Throws AppError with descriptive messages.
 * @param {Object} file - Express Multer file object
 */
export const validateUploadedImage = (file) => {
  if (!file) {
    throw new AppError('Please select a product image.', 400);
  }

  // Size limit check (5 MB)
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError('Each product image must be 5 MB or smaller.', 400);
  }

  if (file.size === 0) {
    throw new AppError('The selected image is invalid or corrupted.', 400);
  }

  // Check magic numbers from buffer or file path
  let buffer;
  if (file.buffer) {
    buffer = file.buffer.slice(0, 16);
  } else if (file.path && fs.existsSync(file.path)) {
    const fd = fs.openSync(file.path, 'r');
    buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
  }

  const signature = detectImageSignature(buffer);
  if (!signature) {
    throw new AppError('Only JPG, JPEG, PNG, and WebP images are allowed.', 400);
  }

  return signature;
};
