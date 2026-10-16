import uploadsService from './uploads.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';
import { uploadFile } from '../../utils/storage.js';
import AppError from '../../errors/AppError.js';

export class UploadsController {
  getAll = catchAsync(async (req, res) => {
    const data = await uploadsService.getAll();
    return sendResponse(res, 200, 'Uploads retrieved successfully', data);
  });

  uploadFile = catchAsync(async (req, res) => {
    if (!req.file) {
      throw new AppError('Please select a product image.', 400);
    }

    const folder = req.body?.folder || req.query?.folder || 'voltspare/products';
    const isProductUpload = folder.includes('product');

    // Authorization check for product uploads
    if (isProductUpload) {
      const roleName = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
      const isStaffOrAdmin = req.isOwner || ['owner', 'admin', 'staff', 'superadmin'].includes(roleName) ||
        (req.permissions && (req.permissions.includes('products.create') || req.permissions.includes('products.update')));

      if (!isStaffOrAdmin) {
        throw new AppError('You are not authorized to upload product images.', 403);
      }
    }

    const prefix = isProductUpload ? 'prod' : (folder.includes('chat') ? 'chat' : 'asset');
    const result = await uploadFile(req.file, { folder, prefix });

    return sendResponse(res, 200, 'File uploaded successfully', result);
  });
}

export default new UploadsController();
