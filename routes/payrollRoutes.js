import express from 'express';
import PayrollController from '../controllers/payrollController.js';
import { authenticate, isAdminOrPM } from '../middleware/auth.js';
import {
  validateObjectId,
  validateQueryParams,
  validateUserRegistration,
  handleValidationErrors
} from '../utils/validation.js';

const router = express.Router();

// All payroll routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/payroll/stats
 * @desc    Get payroll statistics
 * @access  Private (Admin, PM)
 */
router.get('/stats', isAdminOrPM, PayrollController.getPayrollStats);

/**
 * @route   GET /api/payroll/pending
 * @desc    Get pending payrolls for approval
 * @access  Private (Admin, PM)
 */
router.get('/pending', isAdminOrPM, PayrollController.getPendingPayrolls);

/**
 * @route   GET /api/payroll
 * @desc    Get all payroll records with pagination
 * @access  Private (Admin, PM)
 * @query   page, limit, employee, status, period, startDate, endDate, sortBy, sortOrder
 */
router.get('/', isAdminOrPM, validateQueryParams, PayrollController.getAllPayrolls);

/**
 * @route   POST /api/payroll
 * @desc    Create new payroll record
 * @access  Private (Admin, PM)
 * @body    { employeeId, period, startDate, endDate, baseSalary, hourlyRate?, overtimeHours?, overtimeRate?, earnings?, deductions?, notes? }
 */
router.post('/', isAdminOrPM, validateUserRegistration, PayrollController.createPayroll);

/**
 * @route   GET /api/payroll/:id
 * @desc    Get payroll by ID
 * @access  Private (Admin, PM)
 * @params  id (ObjectId)
 */
router.get('/:id', validateObjectId('id'), PayrollController.getPayrollById);

/**
 * @route   PUT /api/payroll/:id
 * @desc    Update payroll record
 * @access  Private (Admin, PM)
 * @params  id (ObjectId)
 * @body    { baseSalary?, hourlyRate?, overtimeHours?, overtimeRate?, earnings?, deductions?, notes?, status? }
 */
router.put('/:id', validateObjectId('id'), validateUserRegistration, PayrollController.updatePayroll);

/**
 * @route   POST /api/payroll/:id/approve
 * @desc    Approve payroll for payment
 * @access  Private (Admin, PM)
 * @params  id (ObjectId)
 */
router.post('/:id/approve', validateObjectId('id'), isAdminOrPM, PayrollController.approvePayroll);

/**
 * @route   POST /api/payroll/:id/pay
 * @desc    Mark payroll as paid
 * @access  Private (Admin, PM)
 * @params  id (ObjectId)
 * @body    { paymentDate?, paymentMethod? }
 */
router.post('/:id/pay', validateObjectId('id'), isAdminOrPM, PayrollController.markAsPaid);

/**
 * @route   GET /api/payroll/employee/:employeeId
 * @desc    Get employee's payroll history
 * @access  Private (Admin, PM, or own payroll)
 * @params  employeeId (ObjectId)
 * @query   startDate?, endDate?
 */
router.get('/employee/:employeeId', validateObjectId('employeeId'), PayrollController.getEmployeePayrollHistory);

/**
 * @route   DELETE /api/payroll/:id
 * @desc    Delete payroll record (draft only)
 * @access  Private (Admin, PM)
 * @params  id (ObjectId)
 */
router.delete('/:id', validateObjectId('id'), isAdminOrPM, PayrollController.deletePayroll);

export default router;