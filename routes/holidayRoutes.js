import express from 'express';
import HolidayController from '../controllers/holidayController.js';
import { authenticate, isAdminOrPM } from '../middleware/auth.js';
import {
  validateObjectId,
  validateQueryParams
} from '../utils/validation.js';

const router = express.Router();

// All holiday routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/holidays
 * @desc    Create a new holiday/announcement
 * @access  Private (Admin, PM)
 */
router.post('/', isAdminOrPM, HolidayController.createHoliday);

/**
 * @route   GET /api/holidays
 * @desc    Get all holidays/announcements
 * @access  Private
 */
router.get('/', validateQueryParams, HolidayController.getHolidays);

/**
 * @route   GET /api/holidays/:id
 * @desc    Get holiday/announcement by ID
 * @access  Private
 */
router.get('/:id', validateObjectId('id'), HolidayController.getHolidayById);

/**
 * @route   PUT /api/holidays/:id
 * @desc    Update holiday/announcement
 * @access  Private (Admin, PM, or creator)
 */
router.put('/:id', validateObjectId('id'), HolidayController.updateHoliday);

/**
 * @route   DELETE /api/holidays/:id
 * @desc    Delete holiday/announcement
 * @access  Private (Admin or creator)
 */
router.delete('/:id', validateObjectId('id'), HolidayController.deleteHoliday);

/**
 * @route   POST /api/holidays/:id/comments
 * @desc    Add comment to holiday/announcement
 * @access  Private
 */
router.post('/:id/comments', validateObjectId('id'), HolidayController.addComment);

/**
 * @route   POST /api/holidays/:id/like
 * @desc    Like holiday/announcement
 * @access  Private
 */
router.post('/:id/like', validateObjectId('id'), HolidayController.likeHoliday);

/**
 * @route   GET /api/holidays/upcoming
 * @desc    Get upcoming holidays
 * @access  Private
 */
router.get('/upcoming', HolidayController.getUpcomingHolidays);

/**
 * @route   GET /api/holidays/my
 * @desc    Get holidays/announcements for current user
 * @access  Private
 */
router.get('/my', HolidayController.getMyHolidays);

export default router;