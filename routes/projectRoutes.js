import express from 'express';
import ProjectController from '../controllers/projectController.js';
import { authenticate, isAdminOrPM } from '../middleware/auth.js';
import {
  validateUserRegistration,
  validateObjectId,
  validateQueryParams
} from '../utils/validation.js';

const router = express.Router();

/**
 * Project Management Routes
 * Base path: /api/projects
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route   GET /api/projects/stats
 * @desc    Get project statistics
 * @access  Private (Admin, PM)
 */
router.get('/stats',
  isAdminOrPM,
  ProjectController.getProjectStats
);

/**
 * @route   GET /api/projects/overdue
 * @desc    Get overdue projects
 * @access  Private (Admin, PM)
 */
router.get('/overdue',
  isAdminOrPM,
  ProjectController.getOverdueProjects
);

/**
 * @route   GET /api/projects
 * @desc    Get all projects with filtering and pagination
 * @access  Private (filtered by role)
 * @query   page, limit, status, priority, search, sortBy, sortOrder
 */
router.get('/',
  validateQueryParams,
  ProjectController.getProjects
);

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private (Admin, PM)
 * @body    { name, description, teamMembers[], endDate, priority?, budget?, tags?, category?, client? }
 */
router.post('/',
  isAdminOrPM,
  ProjectController.createProject
);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private (filtered by role)
 * @params  id (ObjectId)
 */
router.get('/:id',
  validateObjectId('id'),
  ProjectController.getProjectById
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private (Admin, PM who manages the project)
 * @params  id (ObjectId)
 * @body    { name?, description?, status?, priority?, budget?, tags?, category?, client? }
 */
router.put('/:id',
  validateObjectId('id'),
  ProjectController.updateProject
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private (Admin, PM who manages the project)
 * @params  id (ObjectId)
 */
router.delete('/:id',
  validateObjectId('id'),
  ProjectController.deleteProject
);

/**
 * @route   POST /api/projects/:id/team-members
 * @desc    Add team member to project
 * @access  Private (Admin, PM who manages the project)
 * @params  id (ObjectId)
 * @body    { userId, role? }
 */
router.post('/:id/team-members',
  validateObjectId('id'),
  ProjectController.addTeamMember
);

/**
 * @route   DELETE /api/projects/:id/team-members
 * @desc    Remove team member from project
 * @access  Private (Admin, PM who manages the project)
 * @params  id (ObjectId)
 * @body    { userId }
 */
router.delete('/:id/team-members',
  validateObjectId('id'),
  ProjectController.removeTeamMember
);

/**
 * @route   GET /api/projects/:id/progress
 * @desc    Get project progress summary
 * @access  Private (filtered by role)
 * @params  id (ObjectId)
 */
router.get('/:id/progress',
  validateObjectId('id'),
  ProjectController.getProjectProgress
);

export default router;