import express from 'express';
import RecruitmentController from '../controllers/recruitmentController.js';
import { authenticate, isAdminOrPM } from '../middleware/auth.js';
import {
  validateObjectId,
  validateQueryParams,
  validateUserRegistration,
  handleValidationErrors
} from '../utils/validation.js';

const router = express.Router();

// All recruitment routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/recruitment/stats
 * @desc    Get recruitment statistics
 * @access  Private (Admin, PM)
 */
router.get('/stats', isAdminOrPM, RecruitmentController.getRecruitmentStats);

/**
 * @route   GET /api/recruitment
 * @desc    Get all job postings with pagination
 * @access  Private
 * @query   page, limit, department, employmentType, experienceLevel, isActive, sortBy, sortOrder
 */
router.get('/', validateQueryParams, RecruitmentController.getAllJobs);

/**
 * @route   POST /api/recruitment
 * @desc    Create new job posting
 * @access  Private (Admin, PM)
 * @body    { jobTitle, jobDescription, department, location, employmentType, experienceLevel, salaryRange?, requiredSkills?, preferredSkills?, qualifications?, responsibilities?, benefits?, applicationDeadline, priority? }
 */
router.post('/', isAdminOrPM, validateUserRegistration, RecruitmentController.createJob);

/**
 * @route   GET /api/recruitment/:id
 * @desc    Get job posting by ID
 * @access  Private
 * @params  id (ObjectId)
 */
router.get('/:id', validateObjectId('id'), RecruitmentController.getJobById);

/**
 * @route   PUT /api/recruitment/:id
 * @desc    Update job posting
 * @access  Private (Admin, PM, or job poster)
 * @params  id (ObjectId)
 * @body    { jobTitle?, jobDescription?, department?, location?, employmentType?, experienceLevel?, salaryRange?, requiredSkills?, preferredSkills?, qualifications?, responsibilities?, benefits?, applicationDeadline?, priority?, isActive? }
 */
router.put('/:id', validateObjectId('id'), validateUserRegistration, RecruitmentController.updateJob);

/**
 * @route   DELETE /api/recruitment/:id
 * @desc    Delete job posting
 * @access  Private (Admin, PM, or job poster)
 * @params  id (ObjectId)
 */
router.delete('/:id', validateObjectId('id'), RecruitmentController.deleteJob);

/**
 * @route   POST /api/recruitment/:id/apply
 * @desc    Apply for a job
 * @access  Private
 * @params  id (ObjectId)
 * @body    { coverLetter? }
 */
router.post('/:id/apply', validateObjectId('id'), RecruitmentController.applyForJob);

/**
 * @route   PUT /api/recruitment/:jobId/application/:applicationId/status
 * @desc    Update application status
 * @access  Private (Admin, PM)
 * @params  jobId (ObjectId), applicationId (string)
 * @body    { status, note? }
 */
router.put('/:jobId/application/:applicationId/status',
  validateObjectId('jobId'),
  isAdminOrPM,
  RecruitmentController.updateApplicationStatus
);

/**
 * @route   POST /api/recruitment/:jobId/application/:applicationId/interview
 * @desc    Schedule interview
 * @access  Private (Admin, PM)
 * @params  jobId (ObjectId), applicationId (string)
 * @body    { scheduledDate, interviewer, interviewType }
 */
router.post('/:jobId/application/:applicationId/interview',
  validateObjectId('jobId'),
  isAdminOrPM,
  RecruitmentController.scheduleInterview
);

/**
 * @route   PUT /api/recruitment/:jobId/application/:applicationId/interview/:interviewId/complete
 * @desc    Complete interview
 * @access  Private (Admin, PM)
 * @params  jobId (ObjectId), applicationId (string), interviewId (string)
 * @body    { feedback, rating, notes? }
 */
router.put('/:jobId/application/:applicationId/interview/:interviewId/complete',
  validateObjectId('jobId'),
  isAdminOrPM,
  RecruitmentController.completeInterview
);

/**
 * @route   POST /api/recruitment/:jobId/application/:applicationId/offer
 * @desc    Make job offer
 * @access  Private (Admin, PM)
 * @params  jobId (ObjectId), applicationId (string)
 * @body    { offeredSalary, startDate }
 */
router.post('/:jobId/application/:applicationId/offer',
  validateObjectId('jobId'),
  isAdminOrPM,
  RecruitmentController.makeOffer
);

/**
 * @route   PUT /api/recruitment/:jobId/application/:applicationId/offer/respond
 * @desc    Respond to job offer
 * @access  Private (Admin, PM)
 * @params  jobId (ObjectId), applicationId (string)
 * @body    { accepted, rejectionReason? }
 */
router.put('/:jobId/application/:applicationId/offer/respond',
  validateObjectId('jobId'),
  isAdminOrPM,
  RecruitmentController.respondToOffer
);

/**
 * @route   GET /api/recruitment/department/:department
 * @desc    Get jobs by department
 * @access  Private
 * @params  department (string)
 */
router.get('/department/:department', RecruitmentController.getJobsByDepartment);

export default router;