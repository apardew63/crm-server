import Holiday from '../models/Holiday.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  USER_ROLES,
  NOTIFICATION_TYPES
} from '../config/constants.js';

/**
 * Holiday/Announcement Controller
 * Handles company holidays, announcements, and important notices
 */
class HolidayController {
  /**
   * Create a new holiday/announcement
   * POST /api/holidays
   */
  static async createHoliday(req, res) {
    try {
      const sanitizedData = sanitizeInput(req.body);
      const {
        title,
        description,
        type,
        date,
        endDate,
        priority = 'medium',
        targetRoles = ['all'],
        targetDepartments = [],
        expiryDate
      } = sanitizedData;

      // Only admin and PM can create holidays/announcements
      if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'Only administrators and project managers can create holidays/announcements'
        });
      }

      const holidayData = {
        title,
        description,
        type,
        priority,
        targetRoles,
        targetDepartments,
        postedBy: req.user._id,
        expiryDate: expiryDate ? new Date(expiryDate) : null
      };

      // Add date fields for holidays
      if (type === 'holiday' && date && date.trim() !== '') {
        holidayData.date = new Date(date);
        if (endDate && endDate.trim() !== '') {
          holidayData.endDate = new Date(endDate);
        }
      }

      const holiday = new Holiday(holidayData);
      await holiday.save();

      // Populate postedBy
      try {
        await holiday.populate('postedBy', 'firstName lastName avatar');
      } catch (populateError) {
        console.error('Populate postedBy error:', populateError);
      }

      // Create notifications for targeted users
      try {
        await HolidayController.createNotificationsForHoliday(holiday, req.user._id);
      } catch (notificationError) {
        console.error('Notification creation error:', notificationError);
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: { holiday }
      });
    } catch (error) {
      console.error('Create holiday error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to create holiday/announcement'
      });
    }
  }

  /**
   * Get all holidays/announcements
   * GET /api/holidays
   */
  static async getHolidays(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status = 'published',
        startDate,
        endDate
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = { status };
      if (type) filter.type = type;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Filter based on user permissions and target audience
      if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
        filter.$or = [
          { targetRoles: 'all' },
          { targetRoles: req.user.role },
          { targetRoles: req.user.designation },
          { targetDepartments: req.user.department }
        ];
      }

      const [holidays, total] = await Promise.all([
        Holiday.find(filter)
          .populate('postedBy', 'firstName lastName avatar')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(validLimit),
        Holiday.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Holidays and announcements retrieved successfully',
        data: {
          holidays,
          pagination: {
            currentPage: validPage,
            totalPages,
            totalItems: total,
            itemsPerPage: validLimit
          }
        }
      });
    } catch (error) {
      console.error('Get holidays error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve holidays and announcements'
      });
    }
  }

  /**
   * Get holiday/announcement by ID
   * GET /api/holidays/:id
   */
  static async getHolidayById(req, res) {
    try {
      const { id } = req.params;

      const holiday = await Holiday.findById(id)
        .populate('postedBy', 'firstName lastName avatar')
        .populate('comments.user', 'firstName lastName avatar');

      if (!holiday) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Holiday/announcement not found'
        });
      }

      // Check if user can view this holiday
      if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
        const canView = holiday.targetRoles.includes('all') ||
          holiday.targetRoles.includes(req.user.role) ||
          holiday.targetRoles.includes(req.user.designation) ||
          holiday.targetDepartments.includes(req.user.department);

        if (!canView) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
            error: 'You are not authorized to view this content'
          });
        }
      }

      // Increment view count
      await holiday.incrementViews();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Holiday/announcement retrieved successfully',
        data: { holiday }
      });
    } catch (error) {
      console.error('Get holiday error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve holiday/announcement'
      });
    }
  }

  /**
   * Update holiday/announcement
   * PUT /api/holidays/:id
   */
  static async updateHoliday(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const holiday = await Holiday.findById(id);
      if (!holiday) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Holiday/announcement not found'
        });
      }

      // Only admin, PM, or the creator can update
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          holiday.postedBy.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only update your own posts'
        });
      }

      const updatedHoliday = await Holiday.findByIdAndUpdate(
        id,
        { ...sanitizedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('postedBy', 'firstName lastName avatar');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_UPDATED,
        data: { holiday: updatedHoliday }
      });
    } catch (error) {
      console.error('Update holiday error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update holiday/announcement'
      });
    }
  }

  /**
   * Delete holiday/announcement
   * DELETE /api/holidays/:id
   */
  static async deleteHoliday(req, res) {
    try {
      const { id } = req.params;

      const holiday = await Holiday.findById(id);
      if (!holiday) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Holiday/announcement not found'
        });
      }

      // Only admin or the creator can delete
      if (req.user.role !== USER_ROLES.ADMIN && holiday.postedBy.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only delete your own posts'
        });
      }

      await Holiday.findByIdAndDelete(id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Holiday/announcement deleted successfully',
        data: null
      });
    } catch (error) {
      console.error('Delete holiday error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to delete holiday/announcement'
      });
    }
  }

  /**
   * Add comment to holiday/announcement
   * POST /api/holidays/:id/comments
   */
  static async addComment(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;

      const holiday = await Holiday.findById(id);
      if (!holiday) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Holiday/announcement not found'
        });
      }

      await holiday.addComment(req.user._id, message);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Comment added successfully',
        data: { holiday }
      });
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to add comment'
      });
    }
  }

  /**
   * Like holiday/announcement
   * POST /api/holidays/:id/like
   */
  static async likeHoliday(req, res) {
    try {
      const { id } = req.params;

      const holiday = await Holiday.findById(id);
      if (!holiday) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Holiday/announcement not found'
        });
      }

      await holiday.like();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Holiday/announcement liked successfully',
        data: { likes: holiday.likes }
      });
    } catch (error) {
      console.error('Like holiday error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to like holiday/announcement'
      });
    }
  }

  /**
   * Get upcoming holidays
   * GET /api/holidays/upcoming
   */
  static async getUpcomingHolidays(req, res) {
    try {
      const { limit = 10 } = req.query;

      const holidays = await Holiday.getUpcomingHolidays(req.user, limit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Upcoming holidays retrieved successfully',
        data: { holidays }
      });
    } catch (error) {
      console.error('Get upcoming holidays error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve upcoming holidays'
      });
    }
  }

  /**
   * Get holidays for current user
   * GET /api/holidays/my
   */
  static async getMyHolidays(req, res) {
    try {
      const { limit = 20 } = req.query;

      const holidays = await Holiday.getAnnouncementsForUser(req.user, limit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Your holidays and announcements retrieved successfully',
        data: { holidays }
      });
    } catch (error) {
      console.error('Get my holidays error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve your holidays and announcements'
      });
    }
  }

  /**
   * Create notifications for holiday/announcement
   * @private
   */
  static async createNotificationsForHoliday(holiday, senderId) {
    // Get users who should receive this notification
    const users = await HolidayController.getTargetUsers(holiday);

    const notificationPromises = users.map(async user => {
      const notificationType = holiday.type === 'holiday' ?
        NOTIFICATION_TYPES.HOLIDAY_POSTED :
        NOTIFICATION_TYPES.ANNOUNCEMENT_POSTED;

      const title = holiday.type === 'holiday' ?
        `New Holiday: ${holiday.title}` :
        `New Announcement: ${holiday.title}`;

      const notification = new Notification({
        recipient: user._id,
        sender: senderId,
        type: notificationType,
        title,
        message: holiday.description.length > 100 ?
          holiday.description.substring(0, 100) + '...' :
          holiday.description,
        priority: holiday.priority,
        relatedEntity: {
          entityType: 'holiday',
          entityId: holiday._id
        },
        action: 'created',
        data: {
          holidayType: holiday.type,
          holidayId: holiday._id
        }
      });

      return await notification.save();
    });

    await Promise.all(notificationPromises);
  }

  /**
   * Get users who should receive notifications for this holiday
   * @private
   */
  static async getTargetUsers(holiday) {
    let filter = { isActive: true };

    if (!holiday.targetRoles.includes('all')) {
      filter.$or = [];

      if (holiday.targetRoles.length > 0) {
        filter.$or.push({ role: { $in: holiday.targetRoles } });
      }

      if (holiday.targetDepartments.length > 0) {
        filter.$or.push({ department: { $in: holiday.targetDepartments } });
      }

      // If no specific targets, send to all
      if (filter.$or.length === 0) {
        delete filter.$or;
      }
    }

    return await User.find(filter).select('_id');
  }
}

export default HolidayController;