import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  USER_ROLES
} from '../config/constants.js';

/**
 * Payroll Controller
 * Handles payroll management, salary calculations, and payment processing
 */
class PayrollController {
  /**
   * Get all payroll records with pagination
   * GET /api/payroll
   */
  static async getAllPayrolls(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        employee,
        status,
        period,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = {};
      if (employee) filter.employee = employee;
      if (status) filter.status = status;
      if (period) filter.period = period;
      if (startDate || endDate) {
        filter.startDate = {};
        if (startDate) filter.startDate.$gte = new Date(startDate);
        if (endDate) filter.startDate.$lte = new Date(endDate);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [payrolls, total] = await Promise.all([
        Payroll.find(filter)
          .populate('employee', 'firstName lastName email employeeId designation department')
          .populate('processedBy', 'firstName lastName')
          .populate('approvedBy', 'firstName lastName')
          .sort(sort)
          .skip(skip)
          .limit(validLimit),
        Payroll.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);
      const hasNextPage = validPage < totalPages;
      const hasPrevPage = validPage > 1;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payroll records retrieved successfully',
        data: {
          payrolls,
          pagination: {
            currentPage: validPage,
            totalPages,
            totalItems: total,
            itemsPerPage: validLimit,
            hasNextPage,
            hasPrevPage
          }
        }
      });
    } catch (error) {
      console.error('Get all payrolls error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve payroll records'
      });
    }
  }

  /**
   * Get payroll by ID
   * GET /api/payroll/:id
   */
  static async getPayrollById(req, res) {
    try {
      const { id } = req.params;

      const payroll = await Payroll.findById(id)
        .populate('employee', 'firstName lastName email employeeId designation department salary')
        .populate('processedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .populate('auditTrail.performedBy', 'firstName lastName');

      if (!payroll) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Payroll record not found'
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payroll record retrieved successfully',
        data: { payroll }
      });
    } catch (error) {
      console.error('Get payroll error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve payroll record'
      });
    }
  }

  /**
   * Create new payroll record
   * POST /api/payroll
   */
  static async createPayroll(req, res) {
    try {
      const sanitizedData = sanitizeInput(req.body);
      const {
        employeeId,
        period,
        startDate,
        endDate,
        baseSalary,
        hourlyRate,
        overtimeHours,
        overtimeRate,
        earnings = {},
        deductions = {},
        notes
      } = sanitizedData;

      // Validate employee exists
      const employee = await User.findById(employeeId);
      if (!employee || !employee.isActive) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Invalid or inactive employee'
        });
      }

      // Check if payroll already exists for this period
      const existingPayroll = await Payroll.findOne({
        employee: employeeId,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      if (existingPayroll) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Payroll record already exists',
          error: 'A payroll record already exists for this employee and period'
        });
      }

      const payrollData = {
        employee: employeeId,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        baseSalary: baseSalary || employee.salary || 0,
        hourlyRate: hourlyRate || 0,
        overtimeHours: overtimeHours || 0,
        overtimeRate: overtimeRate || 0,
        earnings,
        deductions,
        notes
      };

      const payroll = new Payroll(payrollData);
      await payroll.save();

      await payroll.populate('employee', 'firstName lastName email employeeId designation department');

      // Add audit trail entry
      payroll.auditTrail.push({
        action: 'created',
        performedBy: req.user._id,
        notes: 'Payroll record created'
      });
      await payroll.save();

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: { payroll }
      });
    } catch (error) {
      console.error('Create payroll error:', error);

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          errors: validationErrors
        });
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to create payroll record'
      });
    }
  }

  /**
   * Update payroll record
   * PUT /api/payroll/:id
   */
  static async updatePayroll(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const payroll = await Payroll.findById(id);
      if (!payroll) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Payroll record not found'
        });
      }

      // Only allow updates if status is draft or pending
      if (!['draft', 'pending'].includes(payroll.status)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Cannot update payroll that has been approved or paid'
        });
      }

      const updatedPayroll = await Payroll.findByIdAndUpdate(
        id,
        { ...sanitizedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('employee processedBy approvedBy', 'firstName lastName email');

      // Add audit trail entry
      updatedPayroll.auditTrail.push({
        action: 'updated',
        performedBy: req.user._id,
        notes: 'Payroll record updated'
      });
      await updatedPayroll.save();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_UPDATED,
        data: { payroll: updatedPayroll }
      });
    } catch (error) {
      console.error('Update payroll error:', error);

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          errors: validationErrors
        });
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update payroll record'
      });
    }
  }

  /**
   * Approve payroll
   * POST /api/payroll/:id/approve
   */
  static async approvePayroll(req, res) {
    try {
      const { id } = req.params;

      const payroll = await Payroll.findById(id);
      if (!payroll) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Payroll record not found'
        });
      }

      if (payroll.status !== 'pending') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Only pending payrolls can be approved'
        });
      }

      await payroll.approve(req.user._id);
      await payroll.populate('employee approvedBy', 'firstName lastName email');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payroll approved successfully',
        data: { payroll }
      });
    } catch (error) {
      console.error('Approve payroll error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to approve payroll'
      });
    }
  }

  /**
   * Mark payroll as paid
   * POST /api/payroll/:id/pay
   */
  static async markAsPaid(req, res) {
    try {
      const { id } = req.params;
      const { paymentDate, paymentMethod } = req.body;

      const payroll = await Payroll.findById(id);
      if (!payroll) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Payroll record not found'
        });
      }

      if (payroll.status !== 'approved') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Only approved payrolls can be marked as paid'
        });
      }

      await payroll.markAsPaid(req.user._id, paymentDate, paymentMethod);
      await payroll.populate('employee processedBy', 'firstName lastName email');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payroll marked as paid successfully',
        data: { payroll }
      });
    } catch (error) {
      console.error('Mark as paid error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to mark payroll as paid'
      });
    }
  }

  /**
   * Get employee's payroll history
   * GET /api/payroll/employee/:employeeId
   */
  static async getEmployeePayrollHistory(req, res) {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          req.user._id.toString() !== employeeId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only view your own payroll history'
        });
      }

      const payrolls = await Payroll.getEmployeePayroll(
        employeeId,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Employee payroll history retrieved successfully',
        data: { payrolls }
      });
    } catch (error) {
      console.error('Get employee payroll history error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve employee payroll history'
      });
    }
  }

  /**
   * Get pending payrolls for approval
   * GET /api/payroll/pending
   */
  static async getPendingPayrolls(req, res) {
    try {
      const payrolls = await Payroll.getPendingPayrolls();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Pending payrolls retrieved successfully',
        data: { payrolls }
      });
    } catch (error) {
      console.error('Get pending payrolls error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve pending payrolls'
      });
    }
  }

  /**
   * Get payroll statistics
   * GET /api/payroll/stats
   */
  static async getPayrollStats(req, res) {
    try {
      const { period = 'monthly' } = req.query;

      const stats = await Payroll.aggregate([
        {
          $match: {
            period,
            status: { $in: ['approved', 'paid'] }
          }
        },
        {
          $group: {
            _id: null,
            totalPayrolls: { $sum: 1 },
            totalGrossPay: { $sum: '$grossPay' },
            totalNetPay: { $sum: '$netPay' },
            totalDeductions: { $sum: '$totalDeductions' },
            averageGrossPay: { $avg: '$grossPay' },
            averageNetPay: { $avg: '$netPay' },
            statusBreakdown: {
              $push: '$status'
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalPayrolls: 0,
        totalGrossPay: 0,
        totalNetPay: 0,
        totalDeductions: 0,
        averageGrossPay: 0,
        averageNetPay: 0,
        statusBreakdown: []
      };

      // Calculate status breakdown
      const statusCount = {};
      result.statusBreakdown.forEach(status => {
        statusCount[status] = (statusCount[status] || 0) + 1;
      });
      result.statusBreakdown = statusCount;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Payroll statistics retrieved successfully',
        data: { stats: result }
      });
    } catch (error) {
      console.error('Get payroll stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve payroll statistics'
      });
    }
  }

  /**
   * Delete payroll record
   * DELETE /api/payroll/:id
   */
  static async deletePayroll(req, res) {
    try {
      const { id } = req.params;

      const payroll = await Payroll.findById(id);
      if (!payroll) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Payroll record not found'
        });
      }

      // Only allow deletion of draft payrolls
      if (payroll.status !== 'draft') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Only draft payrolls can be deleted'
        });
      }

      await Payroll.findByIdAndDelete(id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_DELETED,
        data: null
      });
    } catch (error) {
      console.error('Delete payroll error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to delete payroll record'
      });
    }
  }
}

export default PayrollController;