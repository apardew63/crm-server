import express from 'express';
import TaskController from '../controllers/taskController.js';
import {
  authenticate,
  isAdminOrPM,
  isOwnerOrAuthorized,
  canPerformAction,
  canCreateTasks, 
  canManageTasks
} from '../middleware/auth.js';
import {
  validateTaskCreation,
  validateTaskUpdate,
  validateComment,
  validateObjectId,
  validateQueryParams,
  validateDateRange
} from '../utils/validation.js';

const router = express.Router();

router.use(authenticate);

// Employee of the Month - must be before /:id route to avoid conflict
router.get('/employee-of-month', TaskController.getEmployeeOfTheMonth);

router.get('/stats', TaskController.getTaskStats);

router.get('/',
  validateQueryParams,
  validateDateRange,
  TaskController.getAllTasks
);

/**
 * @route   POST /api/tasks
 * @desc    Create new task
 * @access  Private (Admin, PM)
 * @body    { title, description, assignedTo, priority?, dueDate, estimatedHours?, category?, tags? }
 */ 
router.post('/',
  canCreateTasks,
  validateTaskCreation,
  TaskController.createTask
);

router.get('/:id',
  validateObjectId('id'),
  TaskController.getTaskById
);

router.put('/:id',
  validateObjectId('id'),
  validateTaskUpdate,
  TaskController.updateTask
);

router.delete('/:id',
  validateObjectId('id'),
  canManageTasks,
  TaskController.deleteTask
);

router.post('/:id/start',
  validateObjectId('id'),
  canPerformAction('start_task'),
  TaskController.startTask
);

router.post('/:id/stop',
  validateObjectId('id'),
  canPerformAction('start_task'),
  TaskController.stopTask
);

router.post('/:id/complete',
  validateObjectId('id'),
  canPerformAction('complete_task'),
  TaskController.completeTask
);

router.post('/:id/comments',
  validateObjectId('id'),
  validateComment,
  TaskController.addComment
);

// New routes for multiple assignees and progress tracking
router.post('/:id/assignees',
  validateObjectId('id'),
  TaskController.addAssignee
);

router.delete('/:id/assignees',
  validateObjectId('id'),
  TaskController.removeAssignee
);

router.put('/:id/progress',
  validateObjectId('id'),
  TaskController.updateProgress
);

router.post('/:id/blockers',
  validateObjectId('id'),
  TaskController.addBlocker
);

router.put('/:id/blockers/:blockerId/resolve',
  validateObjectId('id'),
  validateObjectId('blockerId'),
  TaskController.resolveBlocker
);

export default router;
