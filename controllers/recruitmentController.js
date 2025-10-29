import Recruitment from '../models/Recruitment.js';
import User from '../models/User.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  USER_ROLES
} from '../config/constants.js';

/**
 * Recruitment Controller
 * Handles job postings, applications, interviews, and hiring process
 */
class RecruitmentController {
  /**
   * Get all job postings with pagination
   * GET /api/recruitment
   */
  static async getAllJobs(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        department,
        employmentType,
        experienceLevel,
        isActive = true,
        sortBy = 'postedDate',
        sortOrder = 'desc'
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = {};
      if (department) filter.department = new RegExp(department, 'i');
      if (employmentType) filter.employmentType = employmentType;
      if (experienceLevel) filter.experienceLevel = experienceLevel;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [jobs, total] = await Promise.all([
        Recruitment.find(filter)
          .populate('postedBy', 'firstName lastName email')
          .sort(sort)
          .skip(skip)
          .limit(validLimit),
        Recruitment.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);
      const hasNextPage = validPage < totalPages;
      const hasPrevPage = validPage > 1;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Job postings retrieved successfully',
        data: {
          jobs,
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
      console.error('Get all jobs error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve job postings'
      });
    }
  }

  /**
   * Get job by ID
   * GET /api/recruitment/:id
   */
  static async getJobById(req, res) {
    try {
      const { id } = req.params;

      const job = await Recruitment.findById(id)
        .populate('postedBy', 'firstName lastName email')
        .populate('applications.notes.addedBy', 'firstName lastName')
        .populate('applications.interviews.interviewer', 'firstName lastName');

      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Job posting retrieved successfully',
        data: { job }
      });
    } catch (error) {
      console.error('Get job error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve job posting'
      });
    }
  }

  /**
   * Create new job posting
   * POST /api/recruitment
   */
  static async createJob(req, res) {
    try {
      const sanitizedData = sanitizeInput(req.body);
      const {
        jobTitle,
        jobDescription,
        department,
        location,
        employmentType,
        experienceLevel,
        salaryRange,
        requiredSkills = [],
        preferredSkills = [],
        qualifications = [],
        responsibilities = [],
        benefits = [],
        applicationDeadline,
        priority
      } = sanitizedData;

      const jobData = {
        jobTitle,
        jobDescription,
        department,
        location,
        employmentType,
        experienceLevel,
        salaryRange,
        requiredSkills,
        preferredSkills,
        qualifications,
        responsibilities,
        benefits,
        applicationDeadline: new Date(applicationDeadline),
        postedBy: req.user._id,
        priority
      };

      const job = new Recruitment(jobData);
      await job.save();

      await job.populate('postedBy', 'firstName lastName email');

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: { job }
      });
    } catch (error) {
      console.error('Create job error:', error);

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
        error: 'Failed to create job posting'
      });
    }
  }

  /**
   * Update job posting
   * PUT /api/recruitment/:id
   */
  static async updateJob(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const job = await Recruitment.findById(id);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      // Check if user can update this job
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          job.postedBy.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only update jobs you posted'
        });
      }

      const updatedJob = await Recruitment.findByIdAndUpdate(
        id,
        { ...sanitizedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('postedBy', 'firstName lastName email');

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_UPDATED,
        data: { job: updatedJob }
      });
    } catch (error) {
      console.error('Update job error:', error);

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
        error: 'Failed to update job posting'
      });
    }
  }

  /**
   * Delete job posting
   * DELETE /api/recruitment/:id
   */
  static async deleteJob(req, res) {
    try {
      const { id } = req.params;

      const job = await Recruitment.findById(id);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          req.user.role !== USER_ROLES.PROJECT_MANAGER &&
          job.postedBy.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only delete jobs you posted'
        });
      }

      // Check if job has applications
      if (job.applications.length > 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Cannot delete job with active applications'
        });
      }

      await Recruitment.findByIdAndDelete(id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_DELETED,
        data: null
      });
    } catch (error) {
      console.error('Delete job error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to delete job posting'
      });
    }
  }

  /**
   * Apply for a job
   * POST /api/recruitment/:id/apply
   */
  static async applyForJob(req, res) {
    try {
      const { id } = req.params;
      const { coverLetter } = req.body;

      const job = await Recruitment.findById(id);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      if (!job.isActive || new Date() > job.applicationDeadline) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job application is closed'
        });
      }

      // Check if user already applied
      const existingApplication = job.applications.find(app =>
        app.applicant.email === req.user.email
      );

      if (existingApplication) {
        return res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          message: 'Already applied',
          error: 'You have already applied for this job'
        });
      }

      await job.addApplication({
        applicant: {
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          phone: req.user.phone
        },
        coverLetter
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Application submitted successfully',
        data: { job }
      });
    } catch (error) {
      console.error('Apply for job error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to submit application'
      });
    }
  }

  /**
   * Update application status
   * PUT /api/recruitment/:jobId/application/:applicationId/status
   */
  static async updateApplicationStatus(req, res) {
    try {
      const { jobId, applicationId } = req.params;
      const { status, note } = req.body;

      const job = await Recruitment.findById(jobId);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      await job.updateApplicationStatus(applicationId, status, req.user._id, note);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Application status updated successfully',
        data: { job }
      });
    } catch (error) {
      console.error('Update application status error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to update application status'
      });
    }
  }

  /**
   * Schedule interview
   * POST /api/recruitment/:jobId/application/:applicationId/interview
   */
  static async scheduleInterview(req, res) {
    try {
      const { jobId, applicationId } = req.params;
      const { scheduledDate, interviewer, interviewType } = req.body;

      const job = await Recruitment.findById(jobId);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      await job.scheduleInterview(applicationId, {
        scheduledDate,
        interviewer,
        interviewType
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Interview scheduled successfully',
        data: { job }
      });
    } catch (error) {
      console.error('Schedule interview error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to schedule interview'
      });
    }
  }

  /**
   * Complete interview
   * PUT /api/recruitment/:jobId/application/:applicationId/interview/:interviewId/complete
   */
  static async completeInterview(req, res) {
    try {
      const { jobId, applicationId, interviewId } = req.params;
      const { feedback, rating, notes } = req.body;

      const job = await Recruitment.findById(jobId);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      await job.completeInterview(applicationId, interviewId, {
        feedback,
        rating,
        notes
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Interview completed successfully',
        data: { job }
      });
    } catch (error) {
      console.error('Complete interview error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to complete interview'
      });
    }
  }

  /**
   * Make job offer
   * POST /api/recruitment/:jobId/application/:applicationId/offer
   */
  static async makeOffer(req, res) {
    try {
      const { jobId, applicationId } = req.params;
      const { offeredSalary, startDate } = req.body;

      const job = await Recruitment.findById(jobId);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      await job.makeOffer(applicationId, {
        offeredSalary,
        startDate
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Job offer sent successfully',
        data: { job }
      });
    } catch (error) {
      console.error('Make offer error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to send job offer'
      });
    }
  }

  /**
   * Respond to offer
   * PUT /api/recruitment/:jobId/application/:applicationId/offer/respond
   */
  static async respondToOffer(req, res) {
    try {
      const { jobId, applicationId } = req.params;
      const { accepted, rejectionReason } = req.body;

      const job = await Recruitment.findById(jobId);
      if (!job) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Job posting not found'
        });
      }

      await job.respondToOffer(applicationId, accepted, rejectionReason);

      const message = accepted ? 'Offer accepted successfully' : 'Offer declined';

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message,
        data: { job }
      });
    } catch (error) {
      console.error('Respond to offer error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to respond to offer'
      });
    }
  }

  /**
   * Get recruitment statistics
   * GET /api/recruitment/stats
   */
  static async getRecruitmentStats(req, res) {
    try {
      const stats = await Recruitment.aggregate([
        {
          $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            activeJobs: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            totalApplications: { $sum: { $size: '$applications' } },
            hiredCandidates: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$applications',
                    cond: { $eq: ['$$this.status', 'hired'] }
                  }
                }
              }
            },
            departmentStats: {
              $push: '$department'
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalJobs: 0,
        activeJobs: 0,
        totalApplications: 0,
        hiredCandidates: 0,
        departmentStats: []
      };

      // Calculate department breakdown
      const departmentCount = {};
      result.departmentStats.forEach(dept => {
        departmentCount[dept] = (departmentCount[dept] || 0) + 1;
      });
      result.departmentStats = departmentCount;

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Recruitment statistics retrieved successfully',
        data: { stats: result }
      });
    } catch (error) {
      console.error('Get recruitment stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve recruitment statistics'
      });
    }
  }

  /**
   * Get jobs by department
   * GET /api/recruitment/department/:department
   */
  static async getJobsByDepartment(req, res) {
    try {
      const { department } = req.params;
      const jobs = await Recruitment.getJobsByDepartment(department);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `${department} job postings retrieved successfully`,
        data: { jobs }
      });
    } catch (error) {
      console.error('Get jobs by department error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve jobs by department'
      });
    }
  }
}

export default RecruitmentController;