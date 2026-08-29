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
      throw new AppError('No file uploaded.', 400);
    }
    const result = await uploadFile(req.file);
    return sendResponse(res, 200, 'File uploaded successfully', result);
  });
}

export default new UploadsController();