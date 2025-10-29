import mongoose from 'mongoose';

/**
 * Recruitment Schema
 * Handles job postings, applications, interviews, and hiring process
 */
const recruitmentSchema = new mongoose.Schema({
  // Job Information
  jobTitle: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },

  jobDescription: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    maxlength: [5000, 'Job description cannot exceed 5000 characters']
  },

  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },

  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },

  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'],
    required: [true, 'Employment type is required']
  },

  experienceLevel: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'lead', 'executive'],
    required: [true, 'Experience level is required']
  },

  // Salary Information
  salaryRange: {
    min: {
      type: Number,
      min: 0
    },
    max: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },

  // Requirements and Skills
  requiredSkills: [{
    type: String,
    trim: true
  }],

  preferredSkills: [{
    type: String,
    trim: true
  }],

  qualifications: [{
    type: String,
    trim: true
  }],

  responsibilities: [{
    type: String,
    trim: true
  }],

  benefits: [{
    type: String,
    trim: true
  }],

  // Job Posting Details
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Posted by is required']
  },

  postedDate: {
    type: Date,
    default: Date.now
  },

  applicationDeadline: {
    type: Date,
    required: [true, 'Application deadline is required']
  },

  isActive: {
    type: Boolean,
    default: true
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Applications
  applications: [{
    applicant: {
      name: {
        type: String,
        required: true,
        trim: true
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
      },
      phone: {
        type: String,
        trim: true
      },
      resume: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    },

    applicationDate: {
      type: Date,
      default: Date.now
    },

    status: {
      type: String,
      enum: ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offered', 'hired', 'rejected'],
      default: 'applied'
    },

    coverLetter: {
      type: String,
      trim: true,
      maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
    },

    notes: [{
      note: {
        type: String,
        required: true,
        trim: true
      },
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],

    // Interview Information
    interviews: [{
      scheduledDate: {
        type: Date,
        required: true
      },
      interviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      interviewType: {
        type: String,
        enum: ['phone', 'video', 'in-person', 'technical', 'hr', 'final'],
        required: true
      },
      status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
        default: 'scheduled'
      },
      feedback: {
        type: String,
        trim: true,
        maxlength: [1000, 'Feedback cannot exceed 1000 characters']
      },
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      notes: {
        type: String,
        trim: true
      }
    }],

    // Offer Information
    offer: {
      offeredSalary: Number,
      offeredDate: Date,
      acceptedDate: Date,
      rejectedDate: Date,
      rejectionReason: String,
      startDate: Date
    }
  }],

  // Statistics
  stats: {
    totalApplications: {
      type: Number,
      default: 0
    },
    shortlisted: {
      type: Number,
      default: 0
    },
    interviewed: {
      type: Number,
      default: 0
    },
    offered: {
      type: Number,
      default: 0
    },
    hired: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
recruitmentSchema.index({ department: 1 });
recruitmentSchema.index({ employmentType: 1 });
recruitmentSchema.index({ experienceLevel: 1 });
recruitmentSchema.index({ isActive: 1 });
recruitmentSchema.index({ postedDate: -1 });
recruitmentSchema.index({ applicationDeadline: 1 });
recruitmentSchema.index({ 'applications.status': 1 });

// Virtual for days until deadline
recruitmentSchema.virtual('daysUntilDeadline').get(function() {
  const now = new Date();
  const deadline = new Date(this.applicationDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for total applications count
recruitmentSchema.virtual('totalApplications').get(function() {
  return this.applications.length;
});

// Pre-save middleware to update statistics
recruitmentSchema.pre('save', function(next) {
  this.stats.totalApplications = this.applications.length;
  this.stats.shortlisted = this.applications.filter(app => app.status === 'shortlisted').length;
  this.stats.interviewed = this.applications.filter(app => app.status === 'interviewed' || app.status === 'interview_scheduled').length;
  this.stats.offered = this.applications.filter(app => app.status === 'offered').length;
  this.stats.hired = this.applications.filter(app => app.status === 'hired').length;

  next();
});

// Instance Methods

/**
 * Add a new application
 * @param {Object} applicationData - Application data
 * @returns {Promise<Recruitment>}
 */
recruitmentSchema.methods.addApplication = async function(applicationData) {
  this.applications.push({
    applicant: applicationData.applicant,
    coverLetter: applicationData.coverLetter,
    applicationDate: new Date()
  });

  return await this.save();
};

/**
 * Update application status
 * @param {string} applicationId - Application ID
 * @param {string} status - New status
 * @param {ObjectId} updatedBy - User who updated
 * @param {string} note - Optional note
 * @returns {Promise<Recruitment>}
 */
recruitmentSchema.methods.updateApplicationStatus = async function(applicationId, status, updatedBy, note = '') {
  const application = this.applications.id(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  application.status = status;

  if (note) {
    application.notes.push({
      note,
      addedBy: updatedBy
    });
  }

  return await this.save();
};

/**
 * Schedule an interview
 * @param {string} applicationId - Application ID
 * @param {Object} interviewData - Interview data
 * @returns {Promise<Recruitment>}
 */
recruitmentSchema.methods.scheduleInterview = async function(applicationId, interviewData) {
  const application = this.applications.id(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  application.interviews.push({
    scheduledDate: interviewData.scheduledDate,
    interviewer: interviewData.interviewer,
    interviewType: interviewData.interviewType,
    status: 'scheduled'
  });

  // Update application status
  application.status = 'interview_scheduled';

  return await this.save();
};

/**
 * Complete an interview
 * @param {string} applicationId - Application ID
 * @param {string} interviewId - Interview ID
 * @param {Object} feedbackData - Feedback data
 * @returns {Promise<Recruitment>}
 */
recruitmentSchema.methods.completeInterview = async function(applicationId, interviewId, feedbackData) {
  const application = this.applications.id(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  const interview = application.interviews.id(interviewId);
  if (!interview) {
    throw new Error('Interview not found');
  }

  interview.status = 'completed';
  interview.feedback = feedbackData.feedback;
  interview.rating = feedbackData.rating;
  interview.notes = feedbackData.notes;

  // Update application status
  application.status = 'interviewed';

  return await this.save();
};

/**
 * Make a job offer
 * @param {string} applicationId - Application ID
 * @param {Object} offerData - Offer data
 * @returns {Promise<Recruitment>}
 */
recruitmentSchema.methods.makeOffer = async function(applicationId, offerData) {
  const application = this.applications.id(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  application.status = 'offered';
  application.offer = {
    offeredSalary: offerData.offeredSalary,
    offeredDate: new Date(),
    startDate: offerData.startDate
  };

  return await this.save();
};

/**
 * Accept or reject offer
 * @param {string} applicationId - Application ID
 * @param {boolean} accepted - Whether offer was accepted
 * @param {string} rejectionReason - Reason for rejection (if rejected)
 * @returns {Promise<Recruitment>}
 */
recruitmentSchema.methods.respondToOffer = async function(applicationId, accepted, rejectionReason = '') {
  const application = this.applications.id(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }

  if (accepted) {
    application.status = 'hired';
    application.offer.acceptedDate = new Date();
  } else {
    application.status = 'rejected';
    application.offer.rejectedDate = new Date();
    application.offer.rejectionReason = rejectionReason;
  }

  return await this.save();
};

// Static Methods

/**
 * Get active job postings
 * @returns {Promise<Array>}
 */
recruitmentSchema.statics.getActiveJobs = function() {
  return this.find({
    isActive: true,
    applicationDeadline: { $gte: new Date() }
  })
  .populate('postedBy', 'firstName lastName email')
  .sort({ postedDate: -1 });
};

/**
 * Get jobs by department
 * @param {string} department - Department name
 * @returns {Promise<Array>}
 */
recruitmentSchema.statics.getJobsByDepartment = function(department) {
  return this.find({
    department: new RegExp(department, 'i'),
    isActive: true
  })
  .populate('postedBy', 'firstName lastName email')
  .sort({ postedDate: -1 });
};

/**
 * Get applications for a job
 * @param {ObjectId} jobId - Job ID
 * @returns {Promise<Object>}
 */
recruitmentSchema.statics.getJobApplications = function(jobId) {
  return this.findById(jobId)
    .populate('applications.notes.addedBy', 'firstName lastName')
    .populate('applications.interviews.interviewer', 'firstName lastName');
};

const Recruitment = mongoose.model('Recruitment', recruitmentSchema);

export default Recruitment;