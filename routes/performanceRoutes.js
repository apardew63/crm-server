import express from 'express';
import PerformanceController from '../controllers/performanceController.js';
import { authenticate, authorize, isAdminOrPM } from '../middleware/auth.js';
import {
  validateObjectId,
  validateQueryParams
} from '../utils/validation.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

/**
 * @route   GET /api/performance
 * @desc    Get all performance records with pagination
 * @access  Private (Admin, PM)
 * @query   page, limit, department, period, startDate, endDate
 */
router.get('/', isAdminOrPM, PerformanceController.getAllPerformances);

// All performance routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/performance/calculate
 * @desc    Calculate performance for an employee
 * @access  Private (Admin, PM)
 */
router.post('/calculate', isAdminOrPM, PerformanceController.calculatePerformance);

/**
 * @route   GET /api/performance/employee/:employeeId
 * @desc    Get performance history for an employee
 * @access  Private (Admin, PM, or own performance)
 */
router.get('/employee/:employeeId',
  validateObjectId('employeeId'),
  PerformanceController.getEmployeePerformance
);

/**
 * @route   GET /api/performance/department/:department
 * @desc    Get performance for department
 * @access  Private (Admin, PM)
 */
router.get('/department/:department', isAdminOrPM, PerformanceController.getDepartmentPerformance);

/**
 * @route   POST /api/performance/employee-of-month
 * @desc    Calculate Employee of the Month
 * @access  Private (Admin, PM)
 */
router.post('/employee-of-month', isAdminOrPM, PerformanceController.calculateEmployeeOfTheMonth);

/**
 * @route   GET /api/performance/employee-of-month/current
 * @desc    Get current Employee of the Month
 * @access  Private
 */
router.get('/employee-of-month/current', PerformanceController.getCurrentEmployeeOfTheMonth);

/**
 * @route   PUT /api/performance/:id
 * @desc    Update performance record
 * @access  Private (Admin, PM)
 */
router.put('/:id',
  validateObjectId('id'),
  isAdminOrPM,
  PerformanceController.updatePerformance
);

/**
 * @route   GET /api/performance/stats
 * @desc    Get performance statistics
 * @access  Private (Admin, PM)
 */
router.get('/stats', isAdminOrPM, PerformanceController.getPerformanceStats);

export default router;