import express from 'express';
import AttendanceController from '../controllers/attendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/temp'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'attendance-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// All attendance routes require authentication
router.use(authenticate);

// Employee routes
router.post('/check-in', AttendanceController.checkIn);
router.post('/check-out', AttendanceController.checkOut);
router.get('/today', AttendanceController.getTodayAttendance);
router.get('/history', AttendanceController.getAttendanceHistory);
router.get('/summary', AttendanceController.getAttendanceSummary);
router.delete('/reset-today', AttendanceController.resetTodayAttendance);

// PDF Upload routes (Admin and PM only)
router.post('/upload-pdf',
  (req, res, next) => {
    const isAdmin = req.user.role === USER_ROLES.ADMIN;
    const isProjectManager = req.user.role === USER_ROLES.PROJECT_MANAGER ||
                            (req.user.role === USER_ROLES.EMPLOYEE && req.user.designation === 'project_manager');

    if (!isAdmin && !isProjectManager) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Project Manager role required.',
        error: 'Insufficient permissions'
      });
    }
    next();
  },
  upload.single('attendanceFile'),
  AttendanceController.uploadAttendancePDF
);

router.get('/uploaded-data',
  (req, res, next) => {
    const isAdmin = req.user.role === USER_ROLES.ADMIN;
    const isProjectManager = req.user.role === USER_ROLES.PROJECT_MANAGER ||
                            (req.user.role === USER_ROLES.EMPLOYEE && req.user.designation === 'project_manager');

    if (!isAdmin && !isProjectManager) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin or Project Manager role required.',
        error: 'Insufficient permissions'
      });
    }
    next();
  },
  AttendanceController.getUploadedAttendanceData
);

// PDF List route (Admin only)
router.get('/uploaded-pdfs',
  (req, res, next) => {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.',
        error: 'Only administrators can list attendance PDFs'
      });
    }
    next();
  },
  AttendanceController.getUploadedPDFs
);

// PDF Download route (Admin only)
router.get('/download-pdf/:filename',
  (req, res, next) => {
    if (req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.',
        error: 'Only administrators can download attendance PDFs'
      });
    }
    next();
  },
  AttendanceController.downloadPDF
);

// Admin routes (require admin or project_manager role)
router.get('/admin/all', (req, res, next) => {
  if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Project Manager role required.',
      error: 'Insufficient permissions'
    });
  }
  next();
}, AttendanceController.getAllAttendance);

router.get('/admin/summary', (req, res, next) => {
  if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Project Manager role required.',
      error: 'Insufficient permissions'
    });
  }
  next();
}, AttendanceController.getAllAttendanceSummary);

export default router;