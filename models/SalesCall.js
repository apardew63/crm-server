import mongoose from 'mongoose';

/**
 * SalesCall Schema
 * Tracks sales calls, leads, and Ringblaze integration
 */
const salesCallSchema = new mongoose.Schema({
  // Sales representative
  salesRep: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sales representative is required']
  },

  // Lead/Customer Information
  lead: {
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
      maxlength: [100, 'Lead name cannot exceed 100 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please provide a valid phone number']
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    position: {
      type: String,
      trim: true,
      maxlength: [50, 'Position cannot exceed 50 characters']
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },

  // Call Details
  callType: {
    type: String,
    enum: ['outbound', 'inbound', 'follow_up', 'cold_call', 'warm_call', 'hot_lead'],
    required: true
  },

  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'missed', 'cancelled', 'no_answer', 'busy', 'wrong_number'],
    default: 'scheduled'
  },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Scheduling
  scheduledDate: {
    type: Date,
    required: true
  },

  duration: {
    type: Number, // in seconds
    default: 0
  },

  // Ringblaze Integration
  ringblazeCallId: {
    type: String,
    sparse: true // Allow null values but enforce uniqueness when present
  },

  ringblazeData: {
    callSid: String,
    from: String,
    to: String,
    direction: String,
    startTime: Date,
    endTime: Date,
    recordingUrl: String,
    transcription: String,
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative']
    },
    tags: [String],
    notes: String
  },

  // Call Outcome
  outcome: {
    type: String,
    enum: [
      'interested', 'not_interested', 'callback_requested', 'meeting_scheduled',
      'proposal_sent', 'deal_closed', 'qualified', 'disqualified', 'no_answer',
      'wrong_person', 'voicemail_left', 'gatekeeper_blocked'
    ]
  },

  outcomeDetails: {
    type: String,
    trim: true,
    maxlength: [1000, 'Outcome details cannot exceed 1000 characters']
  },

  // Follow-up
  followUpRequired: {
    type: Boolean,
    default: false
  },

  followUpDate: {
    type: Date,
    default: null
  },

  followUpNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Follow-up notes cannot exceed 500 characters']
  },

  // Deal Information
  dealValue: {
    type: Number,
    min: 0,
    default: 0
  },

  dealCurrency: {
    type: String,
    default: 'USD',
    maxlength: [3, 'Currency code cannot exceed 3 characters']
  },

  dealClosed: {
    type: Boolean,
    default: false
  },

  dealClosedDate: {
    type: Date,
    default: null
  },

  // Call Notes and Script
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },

  scriptUsed: {
    type: String,
    trim: true
  },

  // Quality Assurance
  callQuality: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },

  qaFeedback: {
    type: String,
    trim: true,
    maxlength: [1000, 'QA feedback cannot exceed 1000 characters']
  },

  qaReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  qaReviewedAt: {
    type: Date
  },

  // Campaign/Lead Source
  campaign: {
    type: String,
    trim: true,
    maxlength: [100, 'Campaign name cannot exceed 100 characters']
  },

  leadSource: {
    type: String,
    enum: ['website', 'referral', 'social_media', 'email', 'cold_call', 'advertisement', 'trade_show', 'other'],
    default: 'cold_call'
  },

  // Custom fields for extensibility
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for call duration in minutes
salesCallSchema.virtual('durationMinutes').get(function() {
  return Math.round(this.duration / 60 * 100) / 100;
});

// Virtual for deal status
salesCallSchema.virtual('dealStatus').get(function() {
  if (this.dealClosed) return 'closed';
  if (this.outcome === 'interested' || this.outcome === 'meeting_scheduled' || this.outcome === 'proposal_sent') return 'in_progress';
  return 'open';
});

// Virtual for call success
salesCallSchema.virtual('isSuccessful').get(function() {
  const successfulOutcomes = ['interested', 'meeting_scheduled', 'proposal_sent', 'deal_closed', 'qualified'];
  return successfulOutcomes.includes(this.outcome);
});

// Indexes
salesCallSchema.index({ salesRep: 1, scheduledDate: -1 });
salesCallSchema.index({ 'lead.phone': 1 });
salesCallSchema.index({ 'lead.email': 1 });
salesCallSchema.index({ status: 1 });
salesCallSchema.index({ outcome: 1 });
salesCallSchema.index({ ringblazeCallId: 1 });
salesCallSchema.index({ followUpDate: 1 });
salesCallSchema.index({ leadSource: 1 });
salesCallSchema.index({ campaign: 1 });

// Pre-save middleware
salesCallSchema.pre('save', function(next) {
  // Auto-set follow up required based on outcome
  if (this.outcome === 'callback_requested' || this.outcome === 'interested') {
    this.followUpRequired = true;
  }

  // Auto-set deal closed if outcome is deal_closed
  if (this.outcome === 'deal_closed') {
    this.dealClosed = true;
    this.dealClosedDate = this.dealClosedDate || new Date();
  }

  next();
});

// Instance methods
salesCallSchema.methods.updateFromRingblaze = async function(ringblazeData) {
  this.ringblazeData = {
    ...this.ringblazeData,
    ...ringblazeData
  };

  if (ringblazeData.startTime && ringblazeData.endTime) {
    this.duration = Math.floor((new Date(ringblazeData.endTime) - new Date(ringblazeData.startTime)) / 1000);
  }

  if (ringblazeData.direction) {
    this.callType = ringblazeData.direction === 'outbound' ? 'outbound' : 'inbound';
  }

  return await this.save();
};

salesCallSchema.methods.scheduleFollowUp = async function(followUpDate, notes = '') {
  this.followUpRequired = true;
  this.followUpDate = followUpDate;
  this.followUpNotes = notes;
  return await this.save();
};

salesCallSchema.methods.markCompleted = async function(outcome, details = '') {
  this.status = 'completed';
  this.outcome = outcome;
  this.outcomeDetails = details;
  return await this.save();
};

// Static methods
salesCallSchema.statics.getSalesRepStats = async function(salesRepId, startDate, endDate) {
  const calls = await this.find({
    salesRep: salesRepId,
    scheduledDate: { $gte: startDate, $lte: endDate }
  });

  const stats = {
    totalCalls: calls.length,
    completedCalls: calls.filter(c => c.status === 'completed').length,
    successfulCalls: calls.filter(c => c.isSuccessful).length,
    totalDuration: calls.reduce((sum, c) => sum + c.duration, 0),
    dealsClosed: calls.filter(c => c.dealClosed).length,
    totalDealValue: calls.reduce((sum, c) => sum + (c.dealValue || 0), 0),
    avgCallDuration: 0,
    conversionRate: 0
  };

  if (stats.totalCalls > 0) {
    stats.avgCallDuration = Math.round(stats.totalDuration / stats.totalCalls);
    stats.conversionRate = Math.round((stats.successfulCalls / stats.totalCalls) * 100);
  }

  return stats;
};

salesCallSchema.statics.getUpcomingCalls = function(salesRepId, limit = 10) {
  return this.find({
    salesRep: salesRepId,
    status: 'scheduled',
    scheduledDate: { $gte: new Date() }
  })
  .sort({ scheduledDate: 1 })
  .limit(limit)
  .populate('salesRep', 'firstName lastName');
};

salesCallSchema.statics.getFollowUpsDue = function(salesRepId, limit = 10) {
  return this.find({
    salesRep: salesRepId,
    followUpRequired: true,
    followUpDate: { $lte: new Date() },
    status: { $ne: 'completed' }
  })
  .sort({ followUpDate: 1 })
  .limit(limit);
};

salesCallSchema.statics.searchLeads = function(salesRepId, searchTerm) {
  const searchRegex = new RegExp(searchTerm, 'i');
  return this.find({
    salesRep: salesRepId,
    $or: [
      { 'lead.name': searchRegex },
      { 'lead.email': searchRegex },
      { 'lead.phone': searchRegex },
      { 'lead.company': searchRegex }
    ]
  }).sort({ updatedAt: -1 });
};

const SalesCall = mongoose.model('SalesCall', salesCallSchema);

export default SalesCall;