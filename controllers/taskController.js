import Task from '../models/Task.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TASK_STATUS,
  USER_ROLES,
  NOTIFICATION_TYPES
} from '../config/constants.js';
import emailService from '../utils/emailService.js';

class TaskController {
  static async getAllTasks(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        assignedTo,
        assignedBy,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        startDate,
        endDate
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);
      const filter = {};

      if (status) filter.status = status;
      if (assignedTo) filter.assignedTo = assignedTo;
      if (assignedBy) filter.assignedBy = assignedBy;

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      if (search) {
        filter.$or = [
          { title: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ];
      }

      if (req.user.role === USER_ROLES.EMPLOYEE) {
        // Employees can see tasks assigned to them
        // Employees with project_manager designation can also see tasks they created
        if (req.user.designation === 'project_manager') {
          filter.$or = [
            { 'assignedTo.user': req.user._id }, // Tasks assigned to them
            { assignedBy: req.user._id }  // Tasks they created
          ];
        } else {
          // Regular employees can only see their own tasks
          filter['assignedTo.user'] = req.user._id;
        }
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [tasks, total] = await Promise.all([
        Task.find(filter)
          .populate('assignedTo.user', 'firstName lastName email designation')
          .populate('assignedBy', 'firstName lastName email designation')
          .sort(sort)
          .skip(skip)
          .limit(validLimit),
        Task.countDocuments(filter)
      ]);

      console.log('Tasks query result:', {
        filter,
        totalTasks: total,
        tasksCount: tasks.length,
        userId: req.user._id,
        userRole: req.user.role,
        userDesignation: req.user.designation
      });

      // Log task details for debugging
      if (tasks.length > 0) {
        console.log('Sample task:', {
          id: tasks[0]._id,
          title: tasks[0].title,
          assignedTo: tasks[0].assignedTo.map(a => ({
            userId: a.user?._id,
            userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Not populated'
          })),
          assignedBy: tasks[0].assignedBy ? `${tasks[0].assignedBy.firstName} ${tasks[0].assignedBy.lastName}` : 'Not populated'
        });
      }

      const totalPages = Math.ceil(total / validLimit);
      const hasNextPage = validPage < totalPages;
      const hasPrevPage = validPage > 1;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Tasks retrieved successfully',
        data: {
          tasks,
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
      console.error('Get tasks error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve tasks'
      });
    }
  }

  static async getTaskById(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findById(id)
        .populate('assignedTo.user', 'firstName lastName email designation phone')
        .populate('assignedBy', 'firstName lastName email designation')
        .populate('comments.user', 'firstName lastName avatar')
        .populate('watchers', 'firstName lastName avatar');

      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      if (req.user.role === USER_ROLES.EMPLOYEE) {
        const isAssigned = task.assignedTo.some(a => a.user._id.toString() === req.user._id.toString());
        if (!isAssigned) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
            error: 'You can only view tasks assigned to you'
          });
        }
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Task retrieved successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve task'
      });
    }
  }

  static async createTask(req, res) {
    try {
      const sanitizedData = sanitizeInput(req.body);
      const {
        title,
        description,
        assignedTo, // Now an array of user IDs
        dueDate,
        startDate,
        estimatedHours,
        category,
        tags = [],
        project
      } = sanitizedData;

      // Validate assignees
      if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'At least one assignee is required'
        });
      }

      // Check if all assigned users exist and are active
      const assignedUsers = await User.find({
        _id: { $in: assignedTo },
        isActive: true
      });

      if (assignedUsers.length !== assignedTo.length) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'One or more assigned users are invalid or inactive'
        });
      }

      // Create assignee objects with roles
      const assignees = assignedTo.map((userId, index) => ({
        user: userId,
        role: index === 0 ? 'primary' : 'collaborator', // First assignee is primary
        assignedAt: new Date()
      }));

      const taskData = {
        title,
        description,
        assignedTo: assignees,
        assignedBy: req.user._id,
        dueDate: new Date(dueDate),
        startDate: startDate ? new Date(startDate) : null,
        estimatedHours,
        category,
        tags,
        project: project || null
      };

      const newTask = new Task(taskData);
      await newTask.save();

      await newTask.populate('assignedTo.user', 'firstName lastName email designation');
      await newTask.populate('assignedBy', 'firstName lastName email designation');

      // Send notifications to all assignees
      try {
        for (const assignee of assignedUsers) {
          await Notification.createTaskNotification({
            recipientId: assignee._id,
            senderId: req.user._id,
            task: newTask,
            type: NOTIFICATION_TYPES.TASK_ASSIGNED,
            action: 'assigned'
          });

          await emailService.sendTaskAssignedEmail(assignee.email, newTask, req.user);
        }
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.TASK_CREATED,
        data: { task: newTask }
      });
    } catch (error) {
      console.error('Create task error:', error);

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
        error: 'Failed to create task'
      });
    }
  }

  static async updateTask(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
      if (req.user.role === USER_ROLES.EMPLOYEE && !isAssigned) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only update your own tasks'
        });
      }

      if (req.user.role === USER_ROLES.EMPLOYEE) {
        const allowedFields = ['status', 'comments'];
        const requestedFields = Object.keys(sanitizedData);
        const unauthorizedFields = requestedFields.filter(field => !allowedFields.includes(field));

        if (unauthorizedFields.length > 0) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
            error: `Employees can only update: ${allowedFields.join(', ')}`
          });
        }
      }

      // Check if status is being updated
      const isStatusUpdate = sanitizedData.status && sanitizedData.status !== task.status;

      const updatedTask = await Task.findByIdAndUpdate(
        id,
        { ...sanitizedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('assignedTo.user assignedBy', 'firstName lastName email designation');

      // Send notification if status was updated
      if (isStatusUpdate) {
        try {
          // Notify the assigner (person who created the task)
          await Notification.createTaskNotification({
            recipientId: task.assignedBy,
            senderId: req.user._id,
            task: updatedTask,
            type: NOTIFICATION_TYPES.TASK_UPDATED,
            action: `changed status to ${sanitizedData.status}`
          });

          // Notify all assignees
          for (const assignee of task.assignedTo) {
            await Notification.createTaskNotification({
              recipientId: assignee.user,
              senderId: req.user._id,
              task: updatedTask,
              type: NOTIFICATION_TYPES.TASK_UPDATED,
              action: `changed status to ${sanitizedData.status}`
            });
          }

          // Send email notification for status updates
          const assigner = await User.findById(task.assignedBy);
          if (assigner) {
            // Send email to assigner
            await emailService.sendTaskStatusUpdateEmail(
              assigner.email,
              updatedTask,
              req.user,
              req.user,
              sanitizedData.status
            );
          }
        } catch (notificationError) {
          console.error('Notification error:', notificationError);
          // Don't fail the update if notification fails
        }
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.TASK_UPDATED,
        data: { task: updatedTask }
      });
    } catch (error) {
      console.error('Update task error:', error);

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
        error: 'Failed to update task'
      });
    }
  }

  static async deleteTask(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      // Check if user has permission to delete tasks
      const canDeleteTasks = req.user.role === USER_ROLES.ADMIN ||
        req.user.role === USER_ROLES.PROJECT_MANAGER ||
        (req.user.role === USER_ROLES.EMPLOYEE && req.user.designation === 'project_manager');

      if (!canDeleteTasks) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'Only administrators and project managers can delete tasks'
        });
      }

      await Task.findByIdAndDelete(id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.TASK_DELETED,
        data: null
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to delete task'
      });
    }
  }

  static async startTask(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
      if (!isAssigned) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_ASSIGNED,
          error: 'You can only start tasks assigned to you'
        });
      }

      await task.startTimeTracking(req.user._id);

      try {
        await Notification.createTaskNotification({
          recipientId: task.assignedBy,
          senderId: req.user._id,
          task,
          type: NOTIFICATION_TYPES.TASK_STARTED,
          action: 'started'
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.TASK_STARTED,
        data: { task }
      });
    } catch (error) {
      console.error('Start task error:', error);

      if (error.message.includes('already active')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.TASK_ALREADY_STARTED,
          error: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to start task'
      });
    }
  }

  static async stopTask(req, res) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
      if (!isAssigned) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_ASSIGNED,
          error: 'You can only stop tasks assigned to you'
        });
      }

      await task.stopTimeTracking(req.user._id, notes);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Task timer stopped successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Stop task error:', error);

      if (error.message.includes('No active time tracking')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: error.message
        });
      }

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to stop task timer'
      });
    }
  }

  static async completeTask(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
      if (!isAssigned) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_ASSIGNED,
          error: 'You can only complete tasks assigned to you'
        });
      }

      await task.markAsCompleted(req.user._id);

      try {
        // Notify the assigner (person who created the task)
        await Notification.createTaskNotification({
          recipientId: task.assignedBy,
          senderId: req.user._id,
          task,
          type: NOTIFICATION_TYPES.TASK_COMPLETED,
          action: 'completed'
        });

        // Notify all assignees
        for (const assignee of task.assignedTo) {
          await Notification.createTaskNotification({
            recipientId: assignee.user,
            senderId: req.user._id,
            task,
            type: NOTIFICATION_TYPES.TASK_COMPLETED,
            action: 'completed'
          });
        }

        const assigner = await User.findById(task.assignedBy);
        if (assigner) {
          await emailService.sendTaskCompletedEmail(assigner.email, task, req.user);
        }
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.TASK_COMPLETED,
        data: { task }
      });
    } catch (error) {
      console.error('Complete task error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to complete task'
      });
    }
  }

  static async getTaskStats(req, res) {
    try {
      let filter = {};

      if (req.user.role === USER_ROLES.EMPLOYEE) {
        // Employees can see tasks assigned to them
        // Employees with project_manager designation can also see tasks they created
        if (req.user.designation === 'project_manager') {
          filter.$or = [
            { 'assignedTo.user': req.user._id }, // Tasks assigned to them
            { assignedBy: req.user._id }  // Tasks they created
          ];
        } else {
          // Regular employees can only see their own tasks
          filter.$or = [
            { 'assignedTo.user': req.user._id },
            { assignedBy: req.user._id }  // Also allow employees to see tasks they created
          ];
        }
        console.log('Employee task filter:', JSON.stringify(filter, null, 2));
        console.log('User ID:', req.user._id, 'Role:', req.user.role, 'Designation:', req.user.designation);
      }

      const [
        totalTasks,
        statusStats,
        overdueTasks,
        activeTimers
      ] = await Promise.all([
        Task.countDocuments(filter),
        Task.aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Task.countDocuments({
          ...filter,
          dueDate: { $lt: new Date() },
          status: { $nin: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED] }
        }),
        Task.countDocuments({
          ...filter,
          'timeTracking.isActive': true
        })
      ]);

      const stats = {
        totalTasks,
        byStatus: statusStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        overdueTasks,
        activeTimers
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Task statistics retrieved successfully',
        data: { stats }
      });
    } catch (error) {
      console.error('Get task stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve task statistics'
      });
    }
  }

  static async addComment(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      if (req.user.role === USER_ROLES.EMPLOYEE) {
        const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
        if (!isAssigned) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
            error: 'You can only comment on tasks assigned to you'
          });
        }
      }

      await task.addComment(req.user._id, message);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Comment added successfully',
        data: { task }
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

  // New methods for multiple assignees and progress tracking

  static async addAssignee(req, res) {
    try {
      const { id } = req.params;
      const { userId, role = 'collaborator' } = req.body;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      // Check permissions (only admin, PM, or task creator can add assignees)
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          task.assignedBy.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only add assignees to tasks you created'
        });
      }

      await task.addAssignee(userId, role);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Assignee added successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Add assignee error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: error.message || 'Failed to add assignee'
      });
    }
  }

  static async removeAssignee(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          task.assignedBy.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only remove assignees from tasks you created'
        });
      }

      await task.removeAssignee(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Assignee removed successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Remove assignee error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: error.message || 'Failed to remove assignee'
      });
    }
  }

  static async updateProgress(req, res) {
    try {
      const { id } = req.params;
      const { percentage, phase } = req.body;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      // Check if user is assigned to the task
      const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
      if (!isAssigned && req.user.role === USER_ROLES.EMPLOYEE) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only update progress on tasks assigned to you'
        });
      }

      await task.updateProgress(percentage, phase, req.user._id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Progress updated successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Update progress error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update progress'
      });
    }
  }

  static async addBlocker(req, res) {
    try {
      const { id } = req.params;
      const { description, severity } = req.body;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      // Check if user is assigned to the task
      const isAssigned = task.assignedTo.some(a => a.user.toString() === req.user._id.toString());
      if (!isAssigned && req.user.role === USER_ROLES.EMPLOYEE) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only add blockers to tasks assigned to you'
        });
      }

      await task.addBlocker(description, severity, req.user._id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Blocker added successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Add blocker error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to add blocker'
      });
    }
  }

  static async resolveBlocker(req, res) {
    try {
      const { id, blockerId } = req.params;

      const task = await Task.findById(id);
      if (!task) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.TASK_NOT_FOUND,
          error: 'Task not found'
        });
      }

      await task.resolveBlocker(blockerId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Blocker resolved successfully',
        data: { task }
      });
    } catch (error) {
      console.error('Resolve blocker error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to resolve blocker'
      });
    }
  }

  static async getEmployeeOfTheMonth(req, res) {
    try {
      // Get current month by default
      const { startDate, endDate } = req.query;
      
      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        // Default to current month
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      const results = await Task.calculateEmployeeOfTheMonth(start, end);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Employee of the month calculated successfully',
        data: results
      });
    } catch (error) {
      console.error('Get employee of the month error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to calculate employee of the month'
      });
    }
  }
}

export default TaskController;
