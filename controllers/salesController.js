import SalesCall from '../models/SalesCall.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  USER_ROLES,
  SALES_OUTCOMES,
  NOTIFICATION_TYPES
} from '../config/constants.js';

/**
 * Sales Controller
 * Handles sales calls, leads, and Ringblaze integration
 */
class SalesController {
  /**
   * Create a new sales call/lead
   * POST /api/sales/calls
   */
  static async createSalesCall(req, res) {
    try {
      const sanitizedData = sanitizeInput(req.body);
      const {
        lead,
        callType,
        priority = 'medium',
        scheduledDate,
        notes,
        campaign,
        leadSource
      } = sanitizedData;

      const salesCallData = {
        salesRep: req.user._id,
        lead,
        callType,
        priority,
        scheduledDate: new Date(scheduledDate),
        notes,
        campaign,
        leadSource
      };

      const salesCall = new SalesCall(salesCallData);
      await salesCall.save();
      await salesCall.populate('salesRep', 'firstName lastName email');

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: { salesCall }
      });
    } catch (error) {
      console.error('Create sales call error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to create sales call'
      });
    }
  }

  /**
   * Get sales calls for current user
   * GET /api/sales/calls
   */
  static async getSalesCalls(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        outcome,
        startDate,
        endDate,
        leadName,
        priority
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = { salesRep: req.user._id };
      if (status) filter.status = status;
      if (outcome) filter.outcome = outcome;
      if (priority) filter.priority = priority;

      if (startDate || endDate) {
        filter.scheduledDate = {};
        if (startDate) filter.scheduledDate.$gte = new Date(startDate);
        if (endDate) filter.scheduledDate.$lte = new Date(endDate);
      }

      if (leadName) {
        filter['lead.name'] = new RegExp(leadName, 'i');
      }

      const [salesCalls, total] = await Promise.all([
        SalesCall.find(filter)
          .sort({ scheduledDate: -1 })
          .skip(skip)
          .limit(validLimit),
        SalesCall.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Sales calls retrieved successfully',
        data: {
          salesCalls,
          pagination: {
            currentPage: validPage,
            totalPages,
            totalItems: total,
            itemsPerPage: validLimit
          }
        }
      });
    } catch (error) {
      console.error('Get sales calls error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve sales calls'
      });
    }
  }

  /**
   * Get sales call by ID
   * GET /api/sales/calls/:id
   */
  static async getSalesCallById(req, res) {
    try {
      const { id } = req.params;

      const salesCall = await SalesCall.findById(id);
      if (!salesCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Sales call not found'
        });
      }

      // Check if user can access this sales call
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          salesCall.salesRep.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only view your own sales calls'
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Sales call retrieved successfully',
        data: { salesCall }
      });
    } catch (error) {
      console.error('Get sales call error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve sales call'
      });
    }
  }

  /**
   * Update sales call
   * PUT /api/sales/calls/:id
   */
  static async updateSalesCall(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const salesCall = await SalesCall.findById(id);
      if (!salesCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Sales call not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          salesCall.salesRep.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only update your own sales calls'
        });
      }

      const updatedSalesCall = await SalesCall.findByIdAndUpdate(
        id,
        { ...sanitizedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_UPDATED,
        data: { salesCall: updatedSalesCall }
      });
    } catch (error) {
      console.error('Update sales call error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update sales call'
      });
    }
  }

  /**
   * Mark sales call as completed
   * POST /api/sales/calls/:id/complete
   */
  static async completeSalesCall(req, res) {
    try {
      const { id } = req.params;
      const { outcome, outcomeDetails, dealValue, dealCurrency } = req.body;

      const salesCall = await SalesCall.findById(id);
      if (!salesCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Sales call not found'
        });
      }

      if (salesCall.salesRep.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only complete your own sales calls'
        });
      }

      await salesCall.markCompleted(outcome, outcomeDetails);

      if (dealValue) {
        salesCall.dealValue = dealValue;
        salesCall.dealCurrency = dealCurrency || 'USD';
        if (outcome === SALES_OUTCOMES.DEAL_CLOSED) {
          salesCall.dealClosed = true;
          salesCall.dealClosedDate = new Date();
        }
        await salesCall.save();
      }

      // Create notification for successful deals
      if (outcome === SALES_OUTCOMES.DEAL_CLOSED) {
        try {
          await Notification.create({
            recipient: salesCall.salesRep,
            sender: req.user._id,
            type: NOTIFICATION_TYPES.SALES_TARGET_ACHIEVED,
            title: 'Deal Closed Successfully!',
            message: `Congratulations! You closed a deal worth ${dealValue} ${dealCurrency} with ${salesCall.lead.name}.`,
            priority: 'high',
            relatedEntity: {
              entityType: 'sales_call',
              entityId: salesCall._id
            },
            data: {
              dealValue,
              dealCurrency,
              leadName: salesCall.lead.name
            }
          });
        } catch (notificationError) {
          console.error('Notification error:', notificationError);
        }
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Sales call completed successfully',
        data: { salesCall }
      });
    } catch (error) {
      console.error('Complete sales call error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to complete sales call'
      });
    }
  }

  /**
   * Get sales statistics for current user
   * GET /api/sales/stats
   */
  static async getSalesStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate) : new Date();

      const stats = await SalesCall.getSalesRepStats(req.user._id, start, end);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Sales statistics retrieved successfully',
        data: { stats, period: { startDate: start, endDate: end } }
      });
    } catch (error) {
      console.error('Get sales stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve sales statistics'
      });
    }
  }

  /**
   * Get upcoming sales calls
   * GET /api/sales/upcoming
   */
  static async getUpcomingCalls(req, res) {
    try {
      const { limit = 10 } = req.query;

      const salesCalls = await SalesCall.getUpcomingCalls(req.user._id, limit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Upcoming sales calls retrieved successfully',
        data: { salesCalls }
      });
    } catch (error) {
      console.error('Get upcoming calls error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve upcoming sales calls'
      });
    }
  }

  /**
   * Get follow-up calls due
   * GET /api/sales/follow-ups
   */
  static async getFollowUps(req, res) {
    try {
      const { limit = 10 } = req.query;

      const salesCalls = await SalesCall.getFollowUpsDue(req.user._id, limit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Follow-up calls retrieved successfully',
        data: { salesCalls }
      });
    } catch (error) {
      console.error('Get follow-ups error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve follow-up calls'
      });
    }
  }

  /**
   * Search leads
   * GET /api/sales/search
   */
  static async searchLeads(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.trim().length < 1) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Search query is required'
        });
      }

      const salesCalls = await SalesCall.searchLeads(req.user._id, q.trim());

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Lead search completed successfully',
        data: { salesCalls, query: q }
      });
    } catch (error) {
      console.error('Search leads error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Search failed'
      });
    }
  }

  /**
   * Ringblaze Integration: Initiate call
   * POST /api/sales/calls/:id/initiate-call
   */
  static async initiateRingblazeCall(req, res) {
    try {
      const { id } = req.params;

      const salesCall = await SalesCall.findById(id);
      if (!salesCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Sales call not found'
        });
      }

      if (salesCall.salesRep.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only initiate calls for your own sales calls'
        });
      }

      // Check if Ringblaze API key is configured
      if (!process.env.RINGBLAZE_API_KEY) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          success: false,
          message: 'Ringblaze integration not configured',
          error: 'Dialer service is not available'
        });
      }

      // Here you would integrate with Ringblaze API
      // For now, we'll simulate the call initiation
      const ringblazeResponse = await this.simulateRingblazeCall(salesCall.lead.phone);

      // Update sales call with Ringblaze data
      salesCall.ringblazeCallId = ringblazeResponse.callId;
      salesCall.status = 'in_progress';
      await salesCall.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Call initiated successfully',
        data: {
          salesCall,
          ringblazeData: ringblazeResponse
        }
      });
    } catch (error) {
      console.error('Initiate Ringblaze call error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to initiate call'
      });
    }
  }

  /**
   * Ringblaze Integration: Update call data
   * POST /api/sales/calls/:id/ringblaze-webhook
   */
  static async updateRingblazeData(req, res) {
    try {
      const { id } = req.params;
      const ringblazeData = req.body;

      const salesCall = await SalesCall.findOne({ ringblazeCallId: ringblazeData.callId });

      if (!salesCall) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'Sales call not found for this Ringblaze call ID',
          error: 'Invalid call ID'
        });
      }

      await salesCall.updateFromRingblaze(ringblazeData);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Ringblaze data updated successfully',
        data: { salesCall }
      });
    } catch (error) {
      console.error('Update Ringblaze data error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update Ringblaze data'
      });
    }
  }

  /**
   * Admin: Get all sales calls
   * GET /api/sales/admin/all
   */
  static async getAllSalesCalls(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        salesRep,
        status,
        outcome,
        startDate,
        endDate
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = {};
      if (salesRep) filter.salesRep = salesRep;
      if (status) filter.status = status;
      if (outcome) filter.outcome = outcome;

      if (startDate || endDate) {
        filter.scheduledDate = {};
        if (startDate) filter.scheduledDate.$gte = new Date(startDate);
        if (endDate) filter.scheduledDate.$lte = new Date(endDate);
      }

      const [salesCalls, total] = await Promise.all([
        SalesCall.find(filter)
          .populate('salesRep', 'firstName lastName email designation')
          .sort({ scheduledDate: -1 })
          .skip(skip)
          .limit(validLimit),
        SalesCall.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'All sales calls retrieved successfully',
        data: {
          salesCalls,
          pagination: {
            currentPage: validPage,
            totalPages,
            totalItems: total,
            itemsPerPage: validLimit
          }
        }
      });
    } catch (error) {
      console.error('Get all sales calls error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve sales calls'
      });
    }
  }

  /**
   * Simulate Ringblaze API call (replace with actual API integration)
   * @private
   */
  static async simulateRingblazeCall(phoneNumber) {
    // This is a simulation - replace with actual Ringblaze API call
    return {
      callId: `call_${Date.now()}`,
      status: 'initiated',
      to: phoneNumber,
      timestamp: new Date().toISOString()
    };
  }
}

export default SalesController;