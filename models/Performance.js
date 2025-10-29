import mongoose from 'mongoose';
import { USER_ROLES } from '../config/constants.js';

/**
 * Performance Schema
 * Tracks employee performance metrics and achievements
 */
const performanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },

  period: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },

  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date,
    required: true
  },

  // Task Performance Metrics
  tasksCompleted: {
    type: Number,
    default: 0
  },

  tasksAssigned: {
    type: Number,
    default: 0
  },

  tasksOverdue: {
    type: Number,
    default: 0
  },

  averageTaskCompletionTime: {
    type: Number, // in hours
    default: 0
  },

  // Attendance Metrics
  attendanceDays: {
    type: Number,
    default: 0
  },

  totalWorkingDays: {
    type: Number,
    default: 0
  },

  lateArrivals: {
    type: Number,
    default: 0
  },

  earlyDepartures: {
    type: Number,
    default: 0
  },

  // Sales Metrics (for sales employees)
  salesCalls: {
    type: Number,
    default: 0
  },

  salesConversions: {
    type: Number,
    default: 0
  },

  revenueGenerated: {
    type: Number,
    default: 0
  },

  dealsClosed: {
    type: Number,
    default: 0
  },

  // Overall Performance Score (0-100)
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Performance Grade
  grade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
    default: 'C'
  },

  // Achievements and Notes
  achievements: [{
    title: String,
    description: String,
    date: {
      type: Date,
      default: Date.now
    },
    points: {
      type: Number,
      default: 0
    }
  }],

  improvements: [{
    area: String,
    suggestion: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],

  // Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  reviewDate: {
    type: Date
  },

  reviewNotes: {
    type: String,
    trim: true
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for task completion rate
performanceSchema.virtual('taskCompletionRate').get(function() {
  return this.tasksAssigned > 0 ? (this.tasksCompleted / this.tasksAssigned) * 100 : 0;
});

// Virtual for attendance rate
performanceSchema.virtual('attendanceRate').get(function() {
  return this.totalWorkingDays > 0 ? (this.attendanceDays / this.totalWorkingDays) * 100 : 0;
});

// Virtual for sales conversion rate
performanceSchema.virtual('salesConversionRate').get(function() {
  return this.salesCalls > 0 ? (this.salesConversions / this.salesCalls) * 100 : 0;
});

// Indexes
performanceSchema.index({ employee: 1, period: 1, startDate: -1 });
performanceSchema.index({ period: 1, startDate: -1 });
performanceSchema.index({ overallScore: -1 });
performanceSchema.index({ grade: 1 });

// Pre-save middleware to calculate overall score
performanceSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.calculateOverallScore();
  }
  next();
});

// Instance method to calculate overall score
performanceSchema.methods.calculateOverallScore = function() {
  let score = 0;
  let weightSum = 0;

  // Task completion (30% weight)
  const taskScore = this.taskCompletionRate;
  score += taskScore * 0.3;
  weightSum += 0.3;

  // Attendance (25% weight)
  const attendanceScore = this.attendanceRate;
  score += attendanceScore * 0.25;
  weightSum += 0.25;

  // On-time delivery (20% weight) - inverse of overdue rate
  const onTimeRate = this.tasksAssigned > 0 ? ((this.tasksAssigned - this.tasksOverdue) / this.tasksAssigned) * 100 : 100;
  score += onTimeRate * 0.2;
  weightSum += 0.2;

  // Sales performance (for sales employees) (25% weight)
  if (this.salesCalls > 0) {
    const salesScore = this.salesConversionRate;
    score += salesScore * 0.25;
    weightSum += 0.25;
  }

  this.overallScore = Math.round(score);

  // Calculate grade based on score
  if (this.overallScore >= 95) this.grade = 'A+';
  else if (this.overallScore >= 90) this.grade = 'A';
  else if (this.overallScore >= 85) this.grade = 'B+';
  else if (this.overallScore >= 80) this.grade = 'B';
  else if (this.overallScore >= 75) this.grade = 'C+';
  else if (this.overallScore >= 70) this.grade = 'C';
  else if (this.overallScore >= 60) this.grade = 'D';
  else this.grade = 'F';
};

// Static methods
performanceSchema.statics.calculateEmployeeOfTheMonth = async function(month, year) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const performances = await this.find({
    period: 'monthly',
    startDate: { $gte: startDate },
    endDate: { $lte: endDate },
    isActive: true
  }).populate('employee', 'firstName lastName email designation department');

  if (performances.length === 0) return null;

  // Find the employee with highest score
  return performances.reduce((best, current) =>
    current.overallScore > best.overallScore ? current : best
  );
};

performanceSchema.statics.getEmployeePerformance = async function(employeeId, period = 'monthly', limit = 12) {
  return await this.find({
    employee: employeeId,
    period,
    isActive: true
  })
  .sort({ startDate: -1 })
  .limit(limit)
  .populate('reviewedBy', 'firstName lastName');
};

performanceSchema.statics.getDepartmentPerformance = async function(department, period = 'monthly', limit = 10) {
  return await this.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'employee',
        foreignField: '_id',
        as: 'employeeData'
      }
    },
    {
      $unwind: '$employeeData'
    },
    {
      $match: {
        'employeeData.department': department,
        period,
        isActive: true
      }
    },
    {
      $sort: { overallScore: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

const Performance = mongoose.model('Performance', performanceSchema);

export default Performance;