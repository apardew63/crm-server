import mongoose from 'mongoose';

/**
 * Project Schema
 * Handles project management with multiple tasks and team members
 */
const projectSchema = new mongoose.Schema({
  // Basic Project Information
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [200, 'Project name cannot exceed 200 characters']
  },

  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true,
    maxlength: [2000, 'Project description cannot exceed 2000 characters']
  },

  // Project Management
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project manager is required']
  },

  teamMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['project_manager', 'lead_developer', 'developer', 'designer', 'tester', 'qa', 'stakeholder'],
      default: 'developer'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Project Status and Progress
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning',
    required: true
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  progress: {
    overall: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    completedTasks: {
      type: Number,
      default: 0
    },
    totalTasks: {
      type: Number,
      default: 0
    },
    onTrack: {
      type: Boolean,
      default: true
    }
  },

  // Timeline
  startDate: {
    type: Date,
    default: Date.now
  },

  endDate: {
    type: Date,
    required: [true, 'Project end date is required']
  },

  actualEndDate: {
    type: Date,
    default: null
  },

  // Budget and Resources
  budget: {
    allocated: {
      type: Number,
      min: 0,
      default: 0
    },
    spent: {
      type: Number,
      min: 0,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },

  // Associated Tasks
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],

  // Milestones
  milestones: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    dueDate: {
      type: Date,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    deliverables: [String]
  }],

  // Risk Management
  risks: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    probability: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['identified', 'mitigated', 'occurred', 'resolved'],
      default: 'identified'
    },
    mitigationPlan: String,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Communication
  stakeholders: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: String,
    role: String,
    contactFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    }
  }],

  // Documentation
  documents: [{
    title: String,
    type: {
      type: String,
      enum: ['requirements', 'design', 'testing', 'deployment', 'other']
    },
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Tags and Categories
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  category: {
    type: String,
    trim: true,
    default: 'development'
  },

  // Client Information (if applicable)
  client: {
    name: String,
    contactPerson: String,
    email: String,
    phone: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals

// Check if project is overdue
projectSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.endDate;
});

// Get project duration in days
projectSchema.virtual('duration').get(function() {
  const end = this.actualEndDate || this.endDate;
  const start = this.startDate;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
});

// Get days remaining
projectSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return 0;
  }
  const now = new Date();
  const end = this.endDate;
  const diffTime = end - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Get active risks count
projectSchema.virtual('activeRisksCount').get(function() {
  return this.risks.filter(risk => risk.status !== 'resolved').length;
});

// Indexes
projectSchema.index({ projectManager: 1 });
projectSchema.index({ 'teamMembers.user': 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ endDate: 1 });
projectSchema.index({ startDate: -1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ tags: 1 });
projectSchema.index({ category: 1 });

// Pre-save middleware
projectSchema.pre('save', function(next) {
  // Auto-update progress based on tasks if tasks are associated
  // This would be implemented when tasks are linked to projects
  next();
});

// Instance Methods

/**
 * Add team member to project
 * @param {ObjectId} userId - User to add
 * @param {string} role - Role in project
 * @returns {Promise<Project>}
 */
projectSchema.methods.addTeamMember = async function(userId, role = 'developer') {
  // Check if user is already in team
  const existingMember = this.teamMembers.find(member =>
    member.user.toString() === userId.toString()
  );

  if (existingMember) {
    throw new Error('User is already a team member of this project');
  }

  this.teamMembers.push({
    user: userId,
    role: role,
    joinedAt: new Date()
  });

  return await this.save();
};

/**
 * Remove team member from project
 * @param {ObjectId} userId - User to remove
 * @returns {Promise<Project>}
 */
projectSchema.methods.removeTeamMember = async function(userId) {
  this.teamMembers = this.teamMembers.filter(member =>
    member.user.toString() !== userId.toString()
  );

  return await this.save();
};

/**
 * Update project progress
 * @param {number} progress - Progress percentage
 * @returns {Promise<Project>}
 */
projectSchema.methods.updateProgress = async function(progress) {
  this.progress.overall = Math.max(0, Math.min(100, progress));

  if (this.progress.overall >= 100) {
    this.status = 'completed';
    this.actualEndDate = new Date();
  }

  return await this.save();
};

/**
 * Add milestone to project
 * @param {Object} milestoneData - Milestone data
 * @returns {Promise<Project>}
 */
projectSchema.methods.addMilestone = async function(milestoneData) {
  this.milestones.push({
    ...milestoneData,
    completed: false
  });

  return await this.save();
};

/**
 * Mark milestone as completed
 * @param {ObjectId} milestoneId - Milestone ID
 * @returns {Promise<Project>}
 */
projectSchema.methods.completeMilestone = async function(milestoneId) {
  const milestone = this.milestones.id(milestoneId);
  if (milestone) {
    milestone.completed = true;
    milestone.completedAt = new Date();
  }

  return await this.save();
};

/**
 * Add risk to project
 * @param {Object} riskData - Risk data
 * @param {ObjectId} reportedBy - User reporting the risk
 * @returns {Promise<Project>}
 */
projectSchema.methods.addRisk = async function(riskData, reportedBy) {
  this.risks.push({
    ...riskData,
    reportedBy: reportedBy,
    reportedAt: new Date()
  });

  return await this.save();
};

/**
 * Update risk status
 * @param {ObjectId} riskId - Risk ID
 * @param {string} status - New status
 * @returns {Promise<Project>}
 */
projectSchema.methods.updateRiskStatus = async function(riskId, status) {
  const risk = this.risks.id(riskId);
  if (risk) {
    risk.status = status;
  }

  return await this.save();
};

// Static Methods

/**
 * Find projects by team member
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Array>}
 */
projectSchema.statics.findByTeamMember = function(userId) {
  return this.find({ 'teamMembers.user': userId })
    .populate('projectManager', 'firstName lastName email')
    .populate('teamMembers.user', 'firstName lastName email designation')
    .sort({ updatedAt: -1 });
};

/**
 * Find projects by project manager
 * @param {ObjectId} pmId - Project Manager ID
 * @returns {Promise<Array>}
 */
projectSchema.statics.findByProjectManager = function(pmId) {
  return this.find({ projectManager: pmId })
    .populate('teamMembers.user', 'firstName lastName email designation')
    .sort({ updatedAt: -1 });
};

/**
 * Get project statistics
 * @returns {Promise<Object>}
 */
projectSchema.statics.getProjectStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBudget: { $sum: '$budget.allocated' },
        spentBudget: { $sum: '$budget.spent' }
      }
    }
  ]);

  const totalProjects = await this.countDocuments();
  const activeProjects = await this.countDocuments({ status: 'active' });
  const completedProjects = await this.countDocuments({ status: 'completed' });
  const overdueProjects = await this.countDocuments({
    status: { $in: ['active', 'planning', 'on_hold'] },
    endDate: { $lt: new Date() }
  });

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    overdueProjects,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalBudget: stat.totalBudget,
        spentBudget: stat.spentBudget
      };
      return acc;
    }, {})
  };
};

/**
 * Get overdue projects
 * @returns {Promise<Array>}
 */
projectSchema.statics.getOverdueProjects = function() {
  return this.find({
    status: { $in: ['active', 'planning', 'on_hold'] },
    endDate: { $lt: new Date() }
  })
  .populate('projectManager', 'firstName lastName email')
  .sort({ endDate: 1 });
};

const Project = mongoose.model('Project', projectSchema);

export default Project;