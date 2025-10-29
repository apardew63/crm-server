import Performance from '../models/Performance.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Attendance from '../models/Attendance.js';
import SalesCall from '../models/SalesCall.js';
import Notification from '../models/Notification.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  USER_ROLES,
  NOTIFICATION_TYPES
} from '../config/constants.js';

/**
 * Performance Controller
 * Handles employee performance tracking and Employee of the Month calculations
 */
class PerformanceController {
  /**
   * Get all performance records with pagination
   * GET /api/performance
   */
  static async getAllPerformances(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        department,
        period,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = {};
      if (department) filter['employee.department'] = new RegExp(department, 'i');
      if (period) filter.period = period;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [performances, total] = await Promise.all([
        Performance.find(filter)
          .populate('employee', 'firstName lastName email designation department')
          .populate('reviewedBy', 'firstName lastName email')
          .sort(sort)
          .skip(skip)
          .limit(validLimit),
        Performance.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);
      const hasNextPage = validPage < totalPages;
      const hasPrevPage = validPage > 1;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Performance records retrieved successfully',
        data: {
          performances,
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
      console.error('Get all performances error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve performance records'
      });
    }
  }

  /**
   * Calculate and create performance record for an employee
   * POST /api/performance/calculate
   */
  static async calculatePerformance(req, res) {
    try {
      const { employeeId, period, startDate, endDate } = req.body;

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Start date must be before end date',
          error: 'Invalid date range'
        });
      }

      // Check if performance record already exists for this period
      const existingPerformance = await Performance.findOne({
        employee: employeeId,
        period,
        startDate: start,
        endDate: end
      });

      if (existingPerformance) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Performance record already exists for this period',
          error: 'Duplicate performance record'
        });
      }

      // Gather performance data
      const performanceData = await this.gatherPerformanceData(employeeId, start, end);

      // Create performance record
      const performance = new Performance({
        employee: employeeId,
        period,
        startDate: start,
        endDate: end,
        ...performanceData
      });

      await performance.save();
      await performance.populate('employee reviewedBy', 'firstName lastName email');

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: { performance }
      });
    } catch (error) {
      console.error('Calculate performance error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to calculate performance'
      });
    }
  }

  /**
   * Get employee performance history
   * GET /api/performance/employee/:employeeId
   */
  static async getEmployeePerformance(req, res) {
    try {
      const { employeeId } = req.params;
      const { period, limit = 12 } = req.query;

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          req.user._id.toString() !== employeeId) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only view your own performance records'
        });
      }

      const performances = await Performance.getEmployeePerformance(employeeId, period, limit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Employee performance retrieved successfully',
        data: { performances }
      });
    } catch (error) {
      console.error('Get employee performance error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve employee performance'
      });
    }
  }

  /**
   * Get department performance
   * GET /api/performance/department/:department
   */
  static async getDepartmentPerformance(req, res) {
    try {
      const { department } = req.params;
      const { period = 'monthly', limit = 10 } = req.query;

      const performances = await Performance.getDepartmentPerformance(department, period, limit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Department performance retrieved successfully',
        data: { performances }
      });
    } catch (error) {
      console.error('Get department performance error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve department performance'
      });
    }
  }

  /**
   * Calculate Employee of the Month
   * POST /api/performance/employee-of-month
   */
  static async calculateEmployeeOfTheMonth(req, res) {
    try {
      const { month, year } = req.body;

      if (!month || !year) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: 'Month and year are required',
          error: 'Missing required parameters'
        });
      }

      const employeeOfTheMonth = await Performance.calculateEmployeeOfTheMonth(month, year);

      if (!employeeOfTheMonth) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: 'No performance data found for the specified month',
          error: 'No eligible employees found'
        });
      }

      // Create notification for the winner
      try {
        await Notification.create({
          recipient: employeeOfTheMonth.employee,
          sender: req.user._id,
          type: NOTIFICATION_TYPES.EMPLOYEE_OF_MONTH,
          title: 'Congratulations! Employee of the Month',
          message: `Congratulations! You have been selected as Employee of the Month for ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} with a performance score of ${employeeOfTheMonth.overallScore}%.`,
          priority: 'high',
          relatedEntity: {
            entityType: 'performance',
            entityId: employeeOfTheMonth._id
          },
          data: {
            month,
            year,
            score: employeeOfTheMonth.overallScore,
            grade: employeeOfTheMonth.grade
          }
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      await employeeOfTheMonth.populate('employee', 'firstName lastName email designation department avatar');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Employee of the Month calculated successfully',
        data: {
          employeeOfTheMonth,
          month,
          year
        }
      });
    } catch (error) {
      console.error('Calculate Employee of the Month error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to calculate Employee of the Month'
      });
    }
  }

  /**
   * Get current Employee of the Month
   * GET /api/performance/employee-of-month/current
   */
  static async getCurrentEmployeeOfTheMonth(req, res) {
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const employeeOfTheMonth = await Performance.calculateEmployeeOfTheMonth(currentMonth, currentYear);

      if (!employeeOfTheMonth) {
        return res.status(HTTP_STATUS.OK).json({
          success: true,
          message: 'No Employee of the Month selected yet',
          data: { employeeOfTheMonth: null }
        });
      }

      await employeeOfTheMonth.populate('employee', 'firstName lastName email designation department avatar');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Current Employee of the Month retrieved successfully',
        data: {
          employeeOfTheMonth,
          month: currentMonth,
          year: currentYear
        }
      });
    } catch (error) {
      console.error('Get current Employee of the Month error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve current Employee of the Month'
      });
    }
  }

  /**
   * Update performance record
   * PUT /api/performance/:id
   */
  static async updatePerformance(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const performance = await Performance.findById(id);
      if (!performance) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Performance record not found'
        });
      }

      // Only admin and PM can update performance records
      if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'Only administrators and project managers can update performance records'
        });
      }

      const updatedPerformance = await Performance.findByIdAndUpdate(
        id,
        {
          ...sanitizedData,
          reviewedBy: req.user._id,
          reviewDate: new Date()
        },
        { new: true, runValidators: true }
      ).populate('employee reviewedBy', 'firstName lastName email');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_UPDATED,
        data: { performance: updatedPerformance }
      });
    } catch (error) {
      console.error('Update performance error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update performance record'
      });
    }
  }

  /**
   * Get performance statistics
   * GET /api/performance/stats
   */
  static async getPerformanceStats(req, res) {
    try {
      const { department, period = 'monthly', startDate, endDate } = req.query;

      let filter = { period };
      if (department) filter['employee.department'] = department;
      if (startDate && endDate) {
        filter.startDate = { $gte: new Date(startDate) };
        filter.endDate = { $lte: new Date(endDate) };
      }

      const stats = await Performance.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        {
          $unwind: '$employeeData'
        },
        {
          $match: {
            ...filter,
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            averageScore: { $avg: '$overallScore' },
            highestScore: { $max: '$overallScore' },
            lowestScore: { $min: '$overallScore' },
            gradeDistribution: {
              $push: '$grade'
            },
            departmentStats: {
              $push: {
                department: '$employeeData.department',
                score: '$overallScore'
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalRecords: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        gradeDistribution: [],
        departmentStats: []
      };

      // Calculate grade distribution
      const gradeCount = {};
      result.gradeDistribution.forEach(grade => {
        gradeCount[grade] = (gradeCount[grade] || 0) + 1;
      });
      result.gradeDistribution = gradeCount;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Performance statistics retrieved successfully',
        data: { stats: result }
      });
    } catch (error) {
      console.error('Get performance stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve performance statistics'
      });
    }
  }

  /**
   * Gather performance data for an employee within a date range
   * @private
   */
  static async gatherPerformanceData(employeeId, startDate, endDate) {
    const employee = await User.findById(employeeId);
    if (!employee) throw new Error('Employee not found');

    // Task Performance
    const tasks = await Task.find({
      assignedTo: employeeId,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const completedTasks = tasks.filter(task => task.status === 'completed');
    const overdueTasks = tasks.filter(task =>
      task.dueDate < endDate && task.status !== 'completed' && task.status !== 'cancelled'
    );

    // Attendance Performance
    const attendanceRecords = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const presentDays = attendanceRecords.filter(attendance =>
      attendance.status === 'present' || attendance.status === 'late'
    ).length;

    const lateArrivals = attendanceRecords.filter(attendance =>
      attendance.checkIn.isLate
    ).length;

    const earlyDepartures = attendanceRecords.filter(attendance =>
      attendance.checkOut.isEarly
    ).length;

    // Sales Performance (for sales employees)
    let salesData = {
      salesCalls: 0,
      salesConversions: 0,
      revenueGenerated: 0,
      dealsClosed: 0
    };

    if (employee.designation === 'sales') {
      const salesCalls = await SalesCall.find({
        salesRep: employeeId,
        scheduledDate: { $gte: startDate, $lte: endDate }
      });

      salesData = {
        salesCalls: salesCalls.length,
        salesConversions: salesCalls.filter(call => call.isSuccessful).length,
        revenueGenerated: salesCalls.reduce((sum, call) => sum + (call.dealValue || 0), 0),
        dealsClosed: salesCalls.filter(call => call.dealClosed).length
      };
    }

    // Calculate time tracking data
    const timeTrackingTasks = await Task.find({
      assignedTo: employeeId,
      'timeTracking.totalTimeSpent': { $gt: 0 },
      updatedAt: { $gte: startDate, $lte: endDate }
    });

    const totalTimeSpent = timeTrackingTasks.reduce((sum, task) =>
      sum + (task.timeTracking.totalTimeSpent || 0), 0
    );

    const averageCompletionTime = completedTasks.length > 0 ?
      totalTimeSpent / completedTasks.length : 0;

    return {
      // Task metrics
      tasksCompleted: completedTasks.length,
      tasksAssigned: tasks.length,
      tasksOverdue: overdueTasks.length,
      averageTaskCompletionTime: Math.round(averageCompletionTime),

      // Attendance metrics
      attendanceDays: presentDays,
      totalWorkingDays: this.calculateWorkingDays(startDate, endDate),
      lateArrivals,
      earlyDepartures,

      // Sales metrics
      ...salesData
    };
  }

  /**
   * Calculate working days between two dates (excluding weekends)
   * @private
   */
  static calculateWorkingDays(startDate, endDate) {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }
}

export default PerformanceController;