import express from 'express';
import SalesController from '../controllers/salesController.js';
import { authenticate, isAdminOrPM } from '../middleware/auth.js';
import {
  validateObjectId,
  validateQueryParams
} from '../utils/validation.js';

const router = express.Router();

// All sales routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/sales/calls
 * @desc    Create a new sales call/lead
 * @access  Private
 */
router.post('/calls', SalesController.createSalesCall);

/**
 * @route   GET /api/sales/calls
 * @desc    Get sales calls for current user
 * @access  Private
 */
router.get('/calls', validateQueryParams, SalesController.getSalesCalls);

/**
 * @route   GET /api/sales/calls/:id
 * @desc    Get sales call by ID
 * @access  Private (own calls or admin)
 */
router.get('/calls/:id', validateObjectId('id'), SalesController.getSalesCallById);

/**
 * @route   PUT /api/sales/calls/:id
 * @desc    Update sales call
 * @access  Private (own calls or admin)
 */
router.put('/calls/:id', validateObjectId('id'), SalesController.updateSalesCall);

/**
 * @route   POST /api/sales/calls/:id/complete
 * @desc    Mark sales call as completed
 * @access  Private (own calls)
 */
router.post('/calls/:id/complete', validateObjectId('id'), SalesController.completeSalesCall);

/**
 * @route   POST /api/sales/calls/:id/initiate-call
 * @desc    Initiate Ringblaze call
 * @access  Private (own calls)
 */
router.post('/calls/:id/initiate-call', validateObjectId('id'), SalesController.initiateRingblazeCall);

/**
 * @route   POST /api/sales/calls/:id/ringblaze-webhook
 * @desc    Ringblaze webhook for call updates
 * @access  Public (for Ringblaze webhooks)
 */
router.post('/calls/:id/ringblaze-webhook', SalesController.updateRingblazeData);

/**
 * @route   GET /api/sales/stats
 * @desc    Get sales statistics for current user
 * @access  Private
 */
router.get('/stats', SalesController.getSalesStats);

/**
 * @route   GET /api/sales/upcoming
 * @desc    Get upcoming sales calls
 * @access  Private
 */
router.get('/upcoming', SalesController.getUpcomingCalls);

/**
 * @route   GET /api/sales/follow-ups
 * @desc    Get follow-up calls due
 * @access  Private
 */
router.get('/follow-ups', SalesController.getFollowUps);

/**
 * @route   GET /api/sales/search
 * @desc    Search leads
 * @access  Private
 */
router.get('/search', SalesController.searchLeads);

// Admin routes
/**
 * @route   GET /api/sales/admin/all
 * @desc    Get all sales calls (admin)
 * @access  Private (Admin, PM)
 */
router.get('/admin/all', isAdminOrPM, validateQueryParams, SalesController.getAllSalesCalls);

export default router;