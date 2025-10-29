import mongoose from 'mongoose';

/**
 * Holiday/Announcement Schema
 * Handles company holidays, announcements, and important notices
 */
const holidaySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },

  type: {
    type: String,
    enum: ['holiday', 'announcement', 'event', 'policy_update', 'company_news', 'reminder'],
    required: true
  },

  // For holidays
  date: {
    type: Date,
    required: function() {
      return this.type === 'holiday';
    }
  },

  endDate: {
    type: Date,
    default: null // For multi-day holidays/events
  },

  // For announcements
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Target audience
  targetRoles: [{
    type: String,
    enum: ['admin', 'project_manager', 'employee', 'hr', 'sales', 'all']
  }],

  targetDepartments: [{
    type: String,
    trim: true
  }],

  // Posted by
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Attachments (optional)
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

  // Engagement tracking
  views: {
    type: Number,
    default: 0
  },

  likes: {
    type: Number,
    default: 0
  },

  // Comments
  allowComments: {
    type: Boolean,
    default: true
  },

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
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],

  // Scheduling
  publishDate: {
    type: Date,
    default: Date.now
  },

  expiryDate: {
    type: Date,
    default: null
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if holiday/announcement is expired
holidaySchema.virtual('isExpired').get(function() {
  return this.expiryDate && new Date() > this.expiryDate;
});

// Virtual for checking if it's currently active
holidaySchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.status === 'published' &&
         this.isActive &&
         (!this.expiryDate || now <= this.expiryDate) &&
         now >= this.publishDate;
});

// Virtual for formatted date range
holidaySchema.virtual('dateRange').get(function() {
  if (!this.date) return null;
  if (!this.endDate || this.date.toDateString() === this.endDate.toDateString()) {
    return this.date.toLocaleDateString();
  }
  return `${this.date.toLocaleDateString()} - ${this.endDate.toLocaleDateString()}`;
});

// Indexes
holidaySchema.index({ type: 1, date: 1 });
holidaySchema.index({ status: 1, publishDate: -1 });
holidaySchema.index({ targetRoles: 1 });
holidaySchema.index({ targetDepartments: 1 });
holidaySchema.index({ postedBy: 1 });
holidaySchema.index({ expiryDate: 1 });

// Pre-save middleware
holidaySchema.pre('save', function(next) {
  // Set default target to 'all' if no specific targets
  if (this.targetRoles.length === 0 && this.targetDepartments.length === 0) {
    this.targetRoles = ['all'];
  }
  next();
});

// Instance methods
holidaySchema.methods.addComment = async function(userId, message) {
  if (!this.allowComments) {
    throw new Error('Comments are not allowed for this post');
  }

  this.comments.push({
    user: userId,
    message,
    timestamp: new Date()
  });

  return await this.save();
};

holidaySchema.methods.likeComment = async function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) {
    throw new Error('Comment not found');
  }

  const likeIndex = comment.likes.indexOf(userId);
  if (likeIndex > -1) {
    comment.likes.splice(likeIndex, 1);
  } else {
    comment.likes.push(userId);
  }

  return await this.save();
};

holidaySchema.methods.incrementViews = async function() {
  this.views += 1;
  return await this.save();
};

holidaySchema.methods.like = async function() {
  this.likes += 1;
  return await this.save();
};

// Static methods
holidaySchema.statics.getActiveHolidays = function(startDate, endDate) {
  return this.find({
    type: 'holiday',
    status: 'published',
    isActive: true,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

holidaySchema.statics.getAnnouncementsForUser = function(user, limit = 20) {
  const query = {
    status: 'published',
    isActive: true,
    $or: [
      { targetRoles: 'all' },
      { targetRoles: user.role },
      { targetRoles: user.designation },
      { targetDepartments: user.department }
    ]
  };

  return this.find(query)
    .populate('postedBy', 'firstName lastName avatar')
    .sort({ publishDate: -1 })
    .limit(limit);
};

holidaySchema.statics.getUpcomingHolidays = function(user, limit = 10) {
  const query = {
    type: { $in: ['holiday', 'announcement'] },
    status: 'published',
    isActive: true,
    $or: [
      { date: { $gte: new Date() } },
      { type: 'announcement' }
    ]
  };

  // Filter based on user permissions if not admin or PM
  if (user.role !== 'admin' && user.role !== 'project_manager') {
    query.$and = [
      query,
      {
        $or: [
          { targetRoles: 'all' },
          { targetRoles: user.role },
          { targetRoles: user.designation },
          { targetDepartments: user.department }
        ]
      }
    ];
    delete query.type;
    delete query.status;
    delete query.isActive;
    delete query.$or;
  }

  return this.find(query)
    .sort({ date: 1, createdAt: -1 })
    .limit(limit);
};

holidaySchema.statics.archiveExpired = function() {
  return this.updateMany(
    {
      expiryDate: { $lt: new Date() },
      status: 'published'
    },
    { status: 'archived' }
  );
};

const Holiday = mongoose.model('Holiday', holidaySchema);

export default Holiday;