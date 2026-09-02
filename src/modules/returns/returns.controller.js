import { returnsService } from './returns.service.js';

export const returnsController = {
  searchBill: async (req, res, next) => {
    try {
      const { q } = req.query;
      const result = await returnsService.searchBill(q);
      res.status(200).json({
        success: true,
        message: 'Bill retrieved successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  createCase: async (req, res, next) => {
    try {
      const result = await returnsService.createCase(req.user._id, req.body);
      res.status(201).json({
        success: true,
        message: 'Return/Exchange case created successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  getAll: async (req, res, next) => {
    try {
      const result = await returnsService.getAll(req.query);
      res.status(200).json({
        success: true,
        message: 'Cases retrieved successfully',
        data: result.cases,
        meta: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req, res, next) => {
    try {
      const result = await returnsService.getById(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Case details retrieved successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status, notes } = req.body;
      const result = await returnsService.updateStatus(
        req.params.id,
        status,
        notes,
        req.user._id
      );
      res.status(200).json({
        success: true,
        message: 'Case status updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  getDamagedItems: async (req, res, next) => {
    try {
      const data = await returnsService.getDamagedItems(req.query);
      res.status(200).json({
        success: true,
        message: 'Damaged items retrieved successfully',
        data: data.items,
        meta: {
          total: data.total,
          page: data.page,
          totalPages: data.totalPages,
          metrics: data.metrics,
        },
      });
    } catch (err) {
      next(err);
    }
  },

};
