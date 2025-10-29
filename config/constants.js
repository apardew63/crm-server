/**
 * Application Constants
 * Centralized location for all application constants and enumerations
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  PROJECT_MANAGER: 'project_manager', 
  EMPLOYEE: 'employee'
};

export const USER_DESIGNATIONS = {
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  DESIGNER: 'designer',
  TESTER: 'tester',
  DEVOPS: 'devops',
  UI_UX: 'ui_ux',
  FRONTEND: 'frontend',
  BACKEND: 'backend',
  FULLSTACK: 'fullstack',
  MOBILE: 'mobile',
  DATA_ANALYST: 'data_analyst',
  PRODUCT_MANAGER: 'product_manager',
  PROJECT_MANAGER: 'project_manager',
  MARKETING: 'marketing',
  SALES: 'sales',
  HR: 'hr',
  OTHER: 'other'
};

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue'
};

export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_STARTED: 'task_started',
  TASK_OVERDUE: 'task_overdue',
  TASK_UPDATED: 'task_updated',
  HOLIDAY_POSTED: 'holiday_posted',
  ANNOUNCEMENT_POSTED: 'announcement_posted',
  EMPLOYEE_OF_MONTH: 'employee_of_month',
  PERFORMANCE_REVIEW: 'performance_review',
  PAYROLL_PROCESSED: 'payroll_processed',
  RECRUITMENT_UPDATE: 'recruitment_update',
  SALES_TARGET_ACHIEVED: 'sales_target_achieved',
  GENERAL: 'general'
};

export const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read'
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};

export const ERROR_MESSAGES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  UNAUTHORIZED_ACCESS: 'Access denied. Authentication required',
  INVALID_TOKEN: 'Invalid or expired token',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions to perform this action',
  
  // User errors
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  INVALID_USER_DATA: 'Invalid user data provided',
  
  // Task errors
  TASK_NOT_FOUND: 'Task not found',
  TASK_ALREADY_STARTED: 'Task has already been started',
  TASK_NOT_ASSIGNED: 'Task is not assigned to you',
  CANNOT_UPDATE_COMPLETED_TASK: 'Cannot update completed task',
  
  // General errors
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Internal server error',
  NOT_FOUND: 'Resource not found',
  DATABASE_ERROR: 'Database operation failed'
};

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  USER_DELETED: 'User deleted successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  
  TASK_CREATED: 'Task created successfully',
  TASK_UPDATED: 'Task updated successfully',
  TASK_DELETED: 'Task deleted successfully',
  TASK_STARTED: 'Task started successfully',
  TASK_COMPLETED: 'Task completed successfully',
  
  NOTIFICATION_SENT: 'Notification sent successfully',
  NOTIFICATION_READ: 'Notification marked as read'
};

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 6,
  TASK_TITLE_MAX_LENGTH: 200,
  TASK_DESCRIPTION_MAX_LENGTH: 2000,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  HOLIDAY_TITLE_MAX_LENGTH: 200,
  HOLIDAY_DESCRIPTION_MAX_LENGTH: 2000,
  SALES_LEAD_NAME_MAX_LENGTH: 100,
  RECRUITMENT_TITLE_MAX_LENGTH: 100,
  RECRUITMENT_DESCRIPTION_MAX_LENGTH: 5000
};

export const PERFORMANCE_PERIODS = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly'
};

export const SALES_CALL_TYPES = {
  OUTBOUND: 'outbound',
  INBOUND: 'inbound',
  FOLLOW_UP: 'follow_up',
  COLD_CALL: 'cold_call',
  WARM_CALL: 'warm_call',
  HOT_LEAD: 'hot_lead'
};

export const SALES_OUTCOMES = {
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not_interested',
  CALLBACK_REQUESTED: 'callback_requested',
  MEETING_SCHEDULED: 'meeting_scheduled',
  PROPOSAL_SENT: 'proposal_sent',
  DEAL_CLOSED: 'deal_closed',
  QUALIFIED: 'qualified',
  DISQUALIFIED: 'disqualified',
  NO_ANSWER: 'no_answer',
  WRONG_PERSON: 'wrong_person',
  VOICEMAIL_LEFT: 'voicemail_left',
  GATEKEEPER_BLOCKED: 'gatekeeper_blocked'
};

export const RECRUITMENT_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  FILLED: 'filled'
};

export const APPLICATION_STATUSES = {
  APPLIED: 'applied',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  INTERVIEWED: 'interviewed',
  OFFERED: 'offered',
  HIRED: 'hired',
  REJECTED: 'rejected'
};

export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  NEW_NOTIFICATION: 'new_notification',
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_STARTED: 'task_started',
  TASK_UPDATED: 'task_updated',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  HOLIDAY_POSTED: 'holiday_posted',
  ANNOUNCEMENT_POSTED: 'announcement_posted',
  EMPLOYEE_OF_MONTH: 'employee_of_month',
  PERFORMANCE_UPDATED: 'performance_updated'
};

export const RATE_LIMIT_CONFIG = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  MESSAGE: 'Too many requests from this IP, please try again later'
};

export default {
  USER_ROLES,
  USER_DESIGNATIONS,
  TASK_STATUS,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_RULES,
  SOCKET_EVENTS,
  RATE_LIMIT_CONFIG,
  PERFORMANCE_PERIODS,
  SALES_CALL_TYPES,
  SALES_OUTCOMES,
  RECRUITMENT_STATUSES,
  APPLICATION_STATUSES
};
