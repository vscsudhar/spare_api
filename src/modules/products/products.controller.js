import productsService from './products.service.js';
import sendResponse from '../../utils/response.js';
import catchAsync from '../../utils/catchAsync.js';

export class ProductsController {
  getAll = catchAsync(async (req, res) => {
    const { products, pagination } = await productsService.getAll(req.query);
    return sendResponse(res, 200, 'Products retrieved successfully', products, pagination);
  });

  create = catchAsync(async (req, res) => {
    const data = await productsService.create(req.body);
    return sendResponse(res, 201, 'Product created successfully', data);
  });

  getById = catchAsync(async (req, res) => {
    const data = await productsService.getById(req.params.id);
    return sendResponse(res, 200, 'Product retrieved successfully', data);
  });

  update = catchAsync(async (req, res) => {
    const data = await productsService.update(req.params.id, req.body);
    return sendResponse(res, 200, 'Product updated successfully', data);
  });

  delete = catchAsync(async (req, res) => {
    await productsService.delete(req.params.id);
    return sendResponse(res, 200, 'Product deleted successfully');
  });

  updateStatus = catchAsync(async (req, res) => {
    const { active } = req.body;
    const data = await productsService.updateStatus(req.params.id, active);
    return sendResponse(res, 200, 'Product status updated successfully', data);
  });

  addImage = catchAsync(async (req, res) => {
    const { url, isDefault } = req.body;
    const data = await productsService.addImage(req.params.id, url, isDefault);
    return sendResponse(res, 200, 'Product image added successfully', data);
  });

  deleteImage = catchAsync(async (req, res) => {
    const data = await productsService.deleteImage(req.params.id, req.params.imageId);
    return sendResponse(res, 200, 'Product image deleted successfully', data);
  });

  getFeatured = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    const { products } = await productsService.getAll({ featured: true, limit, active: true });
    return sendResponse(res, 200, 'Featured products retrieved successfully', products);
  });

  getSearch = catchAsync(async (req, res) => {
    const searchVal = req.query.q || '';
    const { products, pagination } = await productsService.getAll({
      search: searchVal,
      active: true,
      page: req.query.page,
      limit: req.query.limit,
    });
    return sendResponse(res, 200, 'Search completed successfully', products, pagination);
  });

  getVehicleBrands = catchAsync(async (req, res) => {
    const data = await productsService.getVehicleBrands();
    return sendResponse(res, 200, 'Vehicle brands retrieved successfully', data);
  });

  createVehicleBrand = catchAsync(async (req, res) => {
    const { name, vehicleTypeName } = req.body;
    const data = await productsService.createVehicleBrand(name, vehicleTypeName);
    return sendResponse(res, 201, 'Vehicle brand created successfully', data);
  });

  updateVehicleBrand = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const data = await productsService.updateVehicleBrand(id, name);
    return sendResponse(res, 200, 'Vehicle brand updated successfully', data);
  });

  getVehicleModels = catchAsync(async (req, res) => {
    const data = await productsService.getVehicleModels();
    return sendResponse(res, 200, 'Vehicle models retrieved successfully', data);
  });

  createVehicleModel = catchAsync(async (req, res) => {
    const { name, brandId, type, years } = req.body;
    const data = await productsService.createVehicleModel(name, brandId, type, years);
    return sendResponse(res, 201, 'Vehicle model created successfully', data);
  });

  updateVehicleModel = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, brandId, type, years } = req.body;
    const data = await productsService.updateVehicleModel(id, name, brandId, type, years);
    return sendResponse(res, 200, 'Vehicle model updated successfully', data);
  });
}

export default new ProductsController();
