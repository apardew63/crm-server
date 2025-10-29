import mongoose from 'mongoose';

/**
 * Payroll Schema
 * Handles employee salary, bonuses, deductions, and payroll processing
 */
const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },

  period: {
    type: String,
    required: [true, 'Payroll period is required'],
    enum: ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']
  },

  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },

  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },

  // Salary Information
  baseSalary: {
    type: Number,
    required: [true, 'Base salary is required'],
    min: 0
  },

  hourlyRate: {
    type: Number,
    min: 0,
    default: 0
  },

  overtimeHours: {
    type: Number,
    min: 0,
    default: 0
  },

  overtimeRate: {
    type: Number,
    min: 0,
    default: 0
  },

  // Earnings
  earnings: {
    bonuses: [{
      type: {
        type: String,
        enum: ['performance', 'attendance', 'project_completion', 'other'],
        default: 'other'
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        trim: true
      },
      date: {
        type: Date,
        default: Date.now
      }
    }],
    commissions: [{
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        trim: true
      },
      date: {
        type: Date,
        default: Date.now
      }
    }],
    allowances: [{
      type: {
        type: String,
        enum: ['housing', 'transport', 'meal', 'medical', 'other'],
        default: 'other'
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        trim: true
      }
    }]
  },

  // Deductions
  deductions: {
    taxes: {
      incomeTax: {
        type: Number,
        min: 0,
        default: 0
      },
      socialSecurity: {
        type: Number,
        min: 0,
        default: 0
      },
      otherTaxes: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    insurance: {
      health: {
        type: Number,
        min: 0,
        default: 0
      },
      dental: {
        type: Number,
        min: 0,
        default: 0
      },
      other: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    loans: [{
      type: {
        type: String,
        enum: ['personal', 'company', 'other'],
        default: 'personal'
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        trim: true
      }
    }],
    other: [{
      type: {
        type: String,
        enum: ['absence', 'late', 'equipment', 'other'],
        default: 'other'
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      description: {
        type: String,
        trim: true
      }
    }]
  },

  // Calculations
  grossPay: {
    type: Number,
    min: 0,
    default: 0
  },

  totalEarnings: {
    type: Number,
    min: 0,
    default: 0
  },

  totalDeductions: {
    type: Number,
    min: 0,
    default: 0
  },

  netPay: {
    type: Number,
    min: 0,
    default: 0
  },

  // Status and Processing
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },

  paymentDate: {
    type: Date,
    default: null
  },

  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'check', 'cash', 'direct_deposit'],
    default: 'bank_transfer'
  },

  // Approval and Processing
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  approvalDate: {
    type: Date,
    default: null
  },

  // Notes and Comments
  notes: {
    type: String,
    trim: true
  },

  // Audit Trail
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'approved', 'paid', 'cancelled'],
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
payrollSchema.index({ employee: 1, startDate: -1, endDate: -1 });
payrollSchema.index({ status: 1 });
payrollSchema.index({ period: 1 });
payrollSchema.index({ paymentDate: 1 });

// Virtual for formatted period
payrollSchema.virtual('formattedPeriod').get(function() {
  const start = this.startDate.toLocaleDateString();
  const end = this.endDate.toLocaleDateString();
  return `${start} - ${end}`;
});

// Pre-save middleware to calculate totals
payrollSchema.pre('save', function(next) {
  // Calculate total earnings
  let totalEarnings = this.baseSalary;

  // Add overtime pay
  totalEarnings += this.overtimeHours * this.overtimeRate;

  // Add bonuses
  totalEarnings += this.earnings.bonuses.reduce((sum, bonus) => sum + bonus.amount, 0);

  // Add commissions
  totalEarnings += this.earnings.commissions.reduce((sum, commission) => sum + commission.amount, 0);

  // Add allowances
  totalEarnings += this.earnings.allowances.reduce((sum, allowance) => sum + allowance.amount, 0);

  this.totalEarnings = totalEarnings;

  // Calculate total deductions
  let totalDeductions = 0;

  // Tax deductions
  totalDeductions += this.deductions.taxes.incomeTax;
  totalDeductions += this.deductions.taxes.socialSecurity;
  totalDeductions += this.deductions.taxes.otherTaxes;

  // Insurance deductions
  totalDeductions += this.deductions.insurance.health;
  totalDeductions += this.deductions.insurance.dental;
  totalDeductions += this.deductions.insurance.other;

  // Loan deductions
  totalDeductions += this.deductions.loans.reduce((sum, loan) => sum + loan.amount, 0);

  // Other deductions
  totalDeductions += this.deductions.other.reduce((sum, deduction) => sum + deduction.amount, 0);

  this.totalDeductions = totalDeductions;

  // Calculate gross and net pay
  this.grossPay = totalEarnings;
  this.netPay = totalEarnings - totalDeductions;

  next();
});

// Instance Methods

/**
 * Approve payroll
 * @param {ObjectId} approverId - User ID of the approver
 * @returns {Promise<Payroll>}
 */
payrollSchema.methods.approve = async function(approverId) {
  this.status = 'approved';
  this.approvedBy = approverId;
  this.approvalDate = new Date();

  this.auditTrail.push({
    action: 'approved',
    performedBy: approverId,
    notes: 'Payroll approved for payment'
  });

  return await this.save();
};

/**
 * Mark as paid
 * @param {ObjectId} processorId - User ID of the person processing payment
 * @param {Date} paymentDate - Date of payment
 * @param {string} paymentMethod - Method of payment
 * @returns {Promise<Payroll>}
 */
payrollSchema.methods.markAsPaid = async function(processorId, paymentDate, paymentMethod) {
  this.status = 'paid';
  this.paymentDate = paymentDate || new Date();
  this.paymentMethod = paymentMethod || this.paymentMethod;
  this.processedBy = processorId;

  this.auditTrail.push({
    action: 'paid',
    performedBy: processorId,
    notes: `Payment processed via ${this.paymentMethod}`
  });

  return await this.save();
};

/**
 * Cancel payroll
 * @param {ObjectId} cancellerId - User ID of the person cancelling
 * @param {string} reason - Reason for cancellation
 * @returns {Promise<Payroll>}
 */
payrollSchema.methods.cancel = async function(cancellerId, reason = '') {
  this.status = 'cancelled';

  this.auditTrail.push({
    action: 'cancelled',
    performedBy: cancellerId,
    notes: reason || 'Payroll cancelled'
  });

  return await this.save();
};

// Static Methods

/**
 * Get payroll for employee in date range
 * @param {ObjectId} employeeId - Employee ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>}
 */
payrollSchema.statics.getEmployeePayroll = function(employeeId, startDate, endDate) {
  const query = { employee: employeeId };
  if (startDate && endDate) {
    query.startDate = { $gte: startDate };
    query.endDate = { $lte: endDate };
  }

  return this.find(query)
    .populate('employee', 'firstName lastName email employeeId')
    .populate('processedBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName')
    .sort({ startDate: -1 });
};

/**
 * Get pending payrolls for approval
 * @returns {Promise<Array>}
 */
payrollSchema.statics.getPendingPayrolls = function() {
  return this.find({ status: 'pending' })
    .populate('employee', 'firstName lastName email employeeId designation')
    .sort({ createdAt: -1 });
};

const Payroll = mongoose.model('Payroll', payrollSchema);

export default Payroll;