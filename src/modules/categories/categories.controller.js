import categoriesService from './categories.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class CategoriesController {
  getAll = catchAsync(async (req, res) => {
    const data = await categoriesService.getAll(req.query);
    return sendResponse(res, 200, 'Categories retrieved successfully', data);
  });

  create = catchAsync(async (req, res) => {
    const data = await categoriesService.create(req.body);
    return sendResponse(res, 201, 'Category created successfully', data);
  });

  update = catchAsync(async (req, res) => {
    const data = await categoriesService.update(req.params.id, req.body);
    return sendResponse(res, 200, 'Category updated successfully', data);
  });
}

export default new CategoriesController();
