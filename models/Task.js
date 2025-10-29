import mongoose from 'mongoose';
import { TASK_STATUS } from '../config/constants.js';

/**
 * Task Schema
 * Handles task creation, assignment, and time tracking
 */
const taskSchema = new mongoose.Schema({
  // Basic Task Information
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [2000, 'Task description cannot exceed 2000 characters']
  },
  
  // Task Assignment (now supports multiple assignees)
  assignedTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['primary', 'collaborator', 'reviewer'],
      default: 'primary'
    }
  }],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must have an assigner']
  },
  
  // Task Properties
  status: {
    type: String,
    enum: Object.values(TASK_STATUS),
    default: TASK_STATUS.PENDING,
    required: true
  },

  // Progress Tracking
  progress: {
    currentPhase: {
      type: String,
      enum: ['planning', 'development', 'testing', 'review', 'deployment', 'completed'],
      default: 'planning'
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    estimatedCompletion: {
      type: Date,
      default: null
    },
    blockers: [{
      description: {
        type: String,
        required: true,
        trim: true
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      reportedAt: {
        type: Date,
        default: Date.now
      },
      resolved: {
        type: Boolean,
        default: false
      },
      resolvedAt: {
        type: Date,
        default: null
      }
    }],
    milestones: [{
      title: {
        type: String,
        required: true,
        trim: true
      },
      description: String,
      dueDate: Date,
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  
  // Dates and Deadlines
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  startDate: {
    type: Date,
    default: null
  },
  completedDate: {
    type: Date,
    default: null
  },
  estimatedHours: {
    type: Number,
    min: 0,
    default: null
  },
  
  // Time Tracking (per assignee)
  timeTracking: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    totalTimeSpent: {
      type: Number, // in milliseconds
      default: 0
    },
    sessions: [{
      startTime: {
        type: Date,
        required: true
      },
      endTime: {
        type: Date,
        default: null
      },
      duration: {
        type: Number, // in milliseconds
        default: 0
      },
      notes: {
        type: String,
        trim: true
      }
    }],
    isActive: {
      type: Boolean,
      default: false
    },
    currentSessionStart: {
      type: Date,
      default: null
    },
    lastActivity: {
      type: Date,
      default: null
    }
  }],
  
  // Task Metadata
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Comments and Updates
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status History
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      trim: true
    }
  }],
  
  // Project Association
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },

  // Additional Properties
  isRecurring: {
    type: Boolean,
    default: false
  },
  parentTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  subtasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  
  // Collaboration
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Custom Fields (for extensibility)
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// Virtuals

// Check if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (this.status === TASK_STATUS.COMPLETED || this.status === TASK_STATUS.CANCELLED) {
    return false;
  }
  return new Date() > this.dueDate;
});

// Get total time spent in hours
taskSchema.virtual('totalHoursSpent').get(function() {
  return Math.round((this.timeTracking.totalTimeSpent / (1000 * 60 * 60)) * 100) / 100;
});

// Get days until due date
taskSchema.virtual('daysUntilDue').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Check if task is currently being tracked by any user
taskSchema.virtual('isBeingTracked').get(function() {
  return this.timeTracking.some(tt => tt.isActive && tt.currentSessionStart);
});

// Get primary assignee
taskSchema.virtual('primaryAssignee').get(function() {
  const primary = this.assignedTo.find(a => a.role === 'primary');
  return primary ? primary.user : (this.assignedTo[0] ? this.assignedTo[0].user : null);
});

// Get all assignees
taskSchema.virtual('allAssignees').get(function() {
  return this.assignedTo.map(a => a.user);
});

// Get active time trackers
taskSchema.virtual('activeTimeTrackers').get(function() {
  return this.timeTracking.filter(tt => tt.isActive);
});

// Indexes for better query performance
taskSchema.index({ 'assignedTo.user': 1, status: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ 'timeTracking.isActive': 1 });
taskSchema.index({ 'timeTracking.user': 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ 'progress.currentPhase': 1 });
taskSchema.index({ 'progress.percentage': 1 });

// Pre-save middleware to update status history
taskSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedBy: this.modifiedBy || this.assignedBy,
      changedAt: new Date(),
      reason: this.statusChangeReason || 'Status updated'
    });
    
    // Update completion date
    if (this.status === TASK_STATUS.COMPLETED) {
      this.completedDate = new Date();
      // Stop time tracking if active
      if (this.timeTracking.isActive) {
        this.stopTimeTracking();
      }
    }
    
    // Update start date
    if (this.status === TASK_STATUS.IN_PROGRESS && !this.startDate) {
      this.startDate = new Date();
    }
  }
  next();
});

// Pre-save middleware to handle overdue tasks
taskSchema.pre('save', function(next) {
  if (this.dueDate && new Date() > this.dueDate && 
      this.status !== TASK_STATUS.COMPLETED && 
      this.status !== TASK_STATUS.CANCELLED &&
      this.status !== TASK_STATUS.OVERDUE) {
    this.status = TASK_STATUS.OVERDUE;
  }
  next();
});

// Instance Methods

/**
 * Start time tracking for the task by a specific user
 * @param {ObjectId} userId - User starting the time tracking
 * @returns {Promise<Task>}
 */
taskSchema.methods.startTimeTracking = async function(userId) {
  // Check if user is assigned to this task
  const isAssigned = this.assignedTo.some(a => a.user.toString() === userId.toString());
  if (!isAssigned) {
    throw new Error('User is not assigned to this task');
  }

  // Find or create time tracking entry for this user
  let userTimeTracking = this.timeTracking.find(tt => tt.user.toString() === userId.toString());

  if (!userTimeTracking) {
    userTimeTracking = {
      user: userId,
      totalTimeSpent: 0,
      sessions: [],
      isActive: false,
      currentSessionStart: null,
      lastActivity: new Date()
    };
    this.timeTracking.push(userTimeTracking);
  }

  if (userTimeTracking.isActive) {
    throw new Error('Time tracking is already active for this user on this task');
  }

  userTimeTracking.isActive = true;
  userTimeTracking.currentSessionStart = new Date();
  userTimeTracking.lastActivity = new Date();

  // Update status to in progress if it's pending
  if (this.status === TASK_STATUS.PENDING) {
    this.status = TASK_STATUS.IN_PROGRESS;
  }

  return await this.save();
};

/**
 * Stop time tracking for the task by a specific user
 * @param {ObjectId} userId - User stopping the time tracking
 * @param {string} notes - Optional notes for the session
 * @returns {Promise<Task>}
 */
taskSchema.methods.stopTimeTracking = async function(userId, notes = '') {
  // Find time tracking entry for this user
  const userTimeTracking = this.timeTracking.find(tt => tt.user.toString() === userId.toString());

  if (!userTimeTracking) {
    throw new Error('No time tracking entry found for this user');
  }

  if (!userTimeTracking.isActive) {
    throw new Error('No active time tracking session for this user on this task');
  }

  const endTime = new Date();
  const startTime = userTimeTracking.currentSessionStart;
  const duration = endTime - startTime;

  // Add session to history
  userTimeTracking.sessions.push({
    startTime,
    endTime,
    duration,
    notes
  });

  // Update total time
  userTimeTracking.totalTimeSpent += duration;
  userTimeTracking.lastActivity = new Date();

  // Reset active tracking
  userTimeTracking.isActive = false;
  userTimeTracking.currentSessionStart = null;

  return await this.save();
};

/**
 * Add a comment to the task
 * @param {ObjectId} userId - User adding the comment
 * @param {string} message - Comment message
 * @returns {Promise<Task>}
 */
taskSchema.methods.addComment = async function(userId, message) {
  this.comments.push({
    user: userId,
    message,
    timestamp: new Date()
  });
  
  return await this.save();
};

/**
 * Mark task as completed
 * @param {ObjectId} userId - User completing the task
 * @returns {Promise<Task>}
 */
taskSchema.methods.markAsCompleted = async function(userId) {
  this.status = TASK_STATUS.COMPLETED;
  this.completedDate = new Date();
  this.modifiedBy = userId;
  this.progress.currentPhase = 'completed';
  this.progress.percentage = 100;

  // Stop all active time tracking sessions
  for (const tt of this.timeTracking) {
    if (tt.isActive) {
      await this.stopTimeTracking(tt.user, 'Task completed');
    }
  }

  return await this.save();
};

/**
 * Add assignee to task
 * @param {ObjectId} userId - User to add as assignee
 * @param {string} role - Role of the assignee (primary, collaborator, reviewer)
 * @returns {Promise<Task>}
 */
taskSchema.methods.addAssignee = async function(userId, role = 'collaborator') {
  // Check if user is already assigned
  const existingAssignee = this.assignedTo.find(a => a.user.toString() === userId.toString());
  if (existingAssignee) {
    throw new Error('User is already assigned to this task');
  }

  this.assignedTo.push({
    user: userId,
    role: role,
    assignedAt: new Date()
  });

  // Initialize time tracking for new assignee
  this.timeTracking.push({
    user: userId,
    totalTimeSpent: 0,
    sessions: [],
    isActive: false,
    currentSessionStart: null,
    lastActivity: new Date()
  });

  return await this.save();
};

/**
 * Remove assignee from task
 * @param {ObjectId} userId - User to remove
 * @returns {Promise<Task>}
 */
taskSchema.methods.removeAssignee = async function(userId) {
  // Don't allow removing the last assignee
  if (this.assignedTo.length <= 1) {
    throw new Error('Cannot remove the last assignee from task');
  }

  // Stop time tracking if active
  const userTimeTracking = this.timeTracking.find(tt => tt.user.toString() === userId.toString());
  if (userTimeTracking && userTimeTracking.isActive) {
    await this.stopTimeTracking(userId, 'Removed from task');
  }

  // Remove assignee and time tracking
  this.assignedTo = this.assignedTo.filter(a => a.user.toString() !== userId.toString());
  this.timeTracking = this.timeTracking.filter(tt => tt.user.toString() !== userId.toString());

  return await this.save();
};

/**
 * Update task progress
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} phase - Current phase
 * @param {ObjectId} userId - User updating progress
 * @returns {Promise<Task>}
 */
taskSchema.methods.updateProgress = async function(percentage, phase, userId) {
  this.progress.percentage = Math.max(0, Math.min(100, percentage));
  if (phase) {
    this.progress.currentPhase = phase;
  }
  this.modifiedBy = userId;

  return await this.save();
};

/**
 * Add blocker to task
 * @param {string} description - Blocker description
 * @param {string} severity - Blocker severity
 * @param {ObjectId} userId - User reporting the blocker
 * @returns {Promise<Task>}
 */
taskSchema.methods.addBlocker = async function(description, severity, userId) {
  this.progress.blockers.push({
    description,
    severity,
    reportedBy: userId,
    reportedAt: new Date()
  });

  return await this.save();
};

/**
 * Resolve blocker
 * @param {ObjectId} blockerId - Blocker ID to resolve
 * @returns {Promise<Task>}
 */
taskSchema.methods.resolveBlocker = async function(blockerId) {
  const blocker = this.progress.blockers.id(blockerId);
  if (blocker) {
    blocker.resolved = true;
    blocker.resolvedAt = new Date();
  }

  return await this.save();
};

/**
 * Assign task to a different user
 * @param {ObjectId} newAssigneeId - New assignee user ID
 * @param {ObjectId} assignerId - User making the assignment
 * @returns {Promise<Task>}
 */
taskSchema.methods.reassign = async function(newAssigneeId, assignerId) {
  this.assignedTo = newAssigneeId;
  this.assignedBy = assignerId;
  this.modifiedBy = assignerId;
  
  return await this.save();
};

/**
 * Add a watcher to the task
 * @param {ObjectId} userId - User ID to add as watcher
 * @returns {Promise<Task>}
 */
taskSchema.methods.addWatcher = async function(userId) {
  if (!this.watchers.includes(userId)) {
    this.watchers.push(userId);
    return await this.save();
  }
  return this;
};

/**
 * Remove a watcher from the task
 * @param {ObjectId} userId - User ID to remove as watcher
 * @returns {Promise<Task>}
 */
taskSchema.methods.removeWatcher = async function(userId) {
  this.watchers = this.watchers.filter(watcherId => 
    watcherId.toString() !== userId.toString()
  );
  return await this.save();
};

// Static Methods

/**
 * Find tasks by assignee
 * @param {ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
taskSchema.statics.findByAssignee = function(userId, options = {}) {
  const query = { 'assignedTo.user': userId };
  if (options.status) query.status = options.status;

  return this.find(query)
    .populate('assignedBy', 'firstName lastName email')
    .populate('assignedTo.user', 'firstName lastName email designation')
    .sort(options.sort || { createdAt: -1 });
};

/**
 * Find overdue tasks
 * @returns {Promise<Array>}
 */
taskSchema.statics.findOverdueTasks = function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $nin: [TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED] }
  }).populate('assignedTo.user assignedBy', 'firstName lastName email');
};

/**
 * Get task statistics for a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>}
 */
taskSchema.statics.getTaskStats = async function(userId) {
  const tasks = await this.find({ 'assignedTo.user': userId });

  const stats = {};
  for (const task of tasks) {
    const userTimeTracking = task.timeTracking.find(tt => tt.user.toString() === userId.toString());
    const totalTime = userTimeTracking ? userTimeTracking.totalTimeSpent : 0;

    if (!stats[task.status]) {
      stats[task.status] = { count: 0, totalHours: 0 };
    }

    stats[task.status].count += 1;
    stats[task.status].totalHours += Math.round((totalTime / (1000 * 60 * 60)) * 100) / 100;
  }

  return stats;
};

/**
 * Find tasks with active time tracking
 * @returns {Promise<Array>}
 */
taskSchema.statics.findActivelyTrackedTasks = function() {
  return this.find({ 'timeTracking.isActive': true })
    .populate('assignedTo.user', 'firstName lastName email');
};

/**
 * Get project progress summary
 * @param {ObjectId} projectId - Project ID (if using projects)
 * @returns {Promise<Object>}
 */
taskSchema.statics.getProjectProgress = async function(projectId = null) {
  const matchQuery = projectId ? { project: projectId } : {};

  const tasks = await this.find(matchQuery);

  const summary = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length,
    inProgressTasks: tasks.filter(t => t.status === TASK_STATUS.IN_PROGRESS).length,
    pendingTasks: tasks.filter(t => t.status === TASK_STATUS.PENDING).length,
    overdueTasks: tasks.filter(t => t.isOverdue).length,
    averageProgress: 0,
    totalTimeSpent: 0,
    activeTimeTrackers: 0,
    blockers: 0
  };

  summary.averageProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress?.percentage || 0), 0) / tasks.length)
    : 0;

  for (const task of tasks) {
    // Calculate total time spent across all assignees
    summary.totalTimeSpent += task.timeTracking.reduce((sum, tt) => sum + tt.totalTimeSpent, 0);
    summary.activeTimeTrackers += task.timeTracking.filter(tt => tt.isActive).length;
    summary.blockers += task.progress?.blockers?.filter(b => !b.resolved).length || 0;
  }

  summary.totalTimeSpent = Math.round((summary.totalTimeSpent / (1000 * 60 * 60)) * 100) / 100; // Convert to hours

  return summary;
};

/**
 * Get tasks by phase
 * @param {string} phase - Phase to filter by
 * @returns {Promise<Array>}
 */
taskSchema.statics.getTasksByPhase = function(phase) {
  return this.find({ 'progress.currentPhase': phase })
    .populate('assignedTo.user', 'firstName lastName email designation')
    .populate('assignedBy', 'firstName lastName email')
    .sort({ 'progress.percentage': -1 });
};

/**
 * Get tasks with blockers
 * @returns {Promise<Array>}
 */
taskSchema.statics.getTasksWithBlockers = function() {
  return this.find({
    'progress.blockers': {
      $elemMatch: { resolved: false }
    }
  })
  .populate('assignedTo.user', 'firstName lastName email designation')
  .populate('assignedBy', 'firstName lastName email')
  .sort({ updatedAt: -1 });
};

/**
 * Calculate Employee of the Month based on task performance
 * @param {Date} startDate - Start date of the period
 * @param {Date} endDate - End date of the period
 * @returns {Promise<Object>} - Employee of the month details
 */
taskSchema.statics.calculateEmployeeOfTheMonth = async function(startDate, endDate) {
  const tasks = await this.find({
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $in: [TASK_STATUS.COMPLETED, TASK_STATUS.IN_PROGRESS] }
  }).populate('assignedTo.user', 'firstName lastName email designation avatar');

  const employeeScores = {};

  for (const task of tasks) {
    for (const assignee of task.assignedTo) {
      const userId = assignee.user._id.toString();
      
      if (!employeeScores[userId]) {
        employeeScores[userId] = {
          user: assignee.user,
          totalScore: 0,
          tasksCompleted: 0,
          tasksInProgress: 0,
          totalTimeSpent: 0,
          onTimeCompletions: 0,
          overdueCompletions: 0,
          averageProgress: 0,
          progressCount: 0
        };
      }

      const score = employeeScores[userId];

      // Calculate time spent by this user
      const userTimeTracking = task.timeTracking.find(tt => tt.user.toString() === userId);
      if (userTimeTracking) {
        score.totalTimeSpent += userTimeTracking.totalTimeSpent;
      }

      // Task completion metrics
      if (task.status === TASK_STATUS.COMPLETED) {
        score.tasksCompleted++;
        score.totalScore += 50; // Base points for completion

        // Bonus for on-time completion
        if (task.completedDate && task.dueDate && task.completedDate <= task.dueDate) {
          score.onTimeCompletions++;
          score.totalScore += 30; // Bonus for on-time
        } else {
          score.overdueCompletions++;
          score.totalScore += 10; // Reduced points for late
        }

        // Bonus for efficiency (completed under estimated time)
        if (task.estimatedHours && userTimeTracking) {
          const actualHours = userTimeTracking.totalTimeSpent / (1000 * 60 * 60);
          if (actualHours < task.estimatedHours) {
            score.totalScore += 20; // Efficiency bonus
          }
        }
      } else if (task.status === TASK_STATUS.IN_PROGRESS) {
        score.tasksInProgress++;
        score.totalScore += 10; // Points for active work
      }

      // Progress tracking bonus
      if (task.progress?.percentage > 0) {
        score.averageProgress += task.progress.percentage;
        score.progressCount++;
        score.totalScore += Math.round(task.progress.percentage / 10); // Up to 10 points
      }
    }
  }

  // Calculate final scores and rankings
  const rankings = Object.values(employeeScores)
    .map(score => {
      // Calculate average progress
      score.averageProgress = score.progressCount > 0 
        ? Math.round(score.averageProgress / score.progressCount) 
        : 0;

      // Calculate completion rate
      const totalTasks = score.tasksCompleted + score.tasksInProgress;
      score.completionRate = totalTasks > 0 
        ? Math.round((score.tasksCompleted / totalTasks) * 100) 
        : 0;

      // Calculate on-time rate
      score.onTimeRate = score.tasksCompleted > 0
        ? Math.round((score.onTimeCompletions / score.tasksCompleted) * 100)
        : 0;

      // Convert time to hours
      score.totalHoursWorked = Math.round((score.totalTimeSpent / (1000 * 60 * 60)) * 10) / 10;

      return score;
    })
    .filter(score => score.tasksCompleted > 0) // Only employees who completed tasks
    .sort((a, b) => b.totalScore - a.totalScore);

  return {
    employeeOfTheMonth: rankings[0] || null,
    topPerformers: rankings.slice(0, 5),
    allRankings: rankings,
    periodStart: startDate,
    periodEnd: endDate
  };
};

const Task = mongoose.model('Task', taskSchema);

export default Task;

