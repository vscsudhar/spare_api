import deliveryChargesService from './delivery-charges.service.js';
import { sendResponse } from '../../utils/response.js';

export const deliveryChargesController = {
  getAll: async (req, res, next) => {
    try {
      const tiers = await deliveryChargesService.getAll(req.query);
      return sendResponse(res, 200, 'Delivery charges retrieved successfully', tiers);
    } catch (err) {
      next(err);
    }
  },

  calculate: async (req, res, next) => {
    try {
      const subTotal = Number(req.query.subTotal || req.body.subTotal || 0);
      const locationId = req.query.locationId || req.body.locationId || null;
      const deliveryFee = await deliveryChargesService.calculateFee(subTotal, locationId);
      return sendResponse(res, 200, 'Delivery fee calculated successfully', {
        subTotal,
        deliveryFee,
        isFreeDelivery: deliveryFee === 0,
      });
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const tier = await deliveryChargesService.create(req.body);
      return sendResponse(res, 201, 'Delivery charge tier created successfully', tier);
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const tier = await deliveryChargesService.update(req.params.id, req.body);
      return sendResponse(res, 200, 'Delivery charge tier updated successfully', tier);
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      await deliveryChargesService.delete(req.params.id);
      return sendResponse(res, 200, 'Delivery charge tier deleted successfully', null);
    } catch (err) {
      next(err);
    }
  },
};

export default deliveryChargesController;
