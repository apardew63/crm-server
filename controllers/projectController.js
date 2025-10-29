import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { validatePagination, sanitizeInput } from '../utils/validation.js';
import {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  USER_ROLES
} from '../config/constants.js';

/**
 * Project Controller
 * Handles project management, team coordination, and progress tracking
 */
class ProjectController {
  /**
   * Create a new project
   * POST /api/projects
   */
  static async createProject(req, res) {
    try {
      const sanitizedData = sanitizeInput(req.body);
      const {
        name,
        description,
        teamMembers = [],
        endDate,
        priority = 'medium',
        budget,
        tags = [],
        category,
        client
      } = sanitizedData;

      // Only admin and PM can create projects
      if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.PROJECT_MANAGER) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'Only administrators and project managers can create projects'
        });
      }

      // Validate team members exist
      if (teamMembers.length > 0) {
        const existingUsers = await User.find({ _id: { $in: teamMembers } });
        if (existingUsers.length !== teamMembers.length) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: ERROR_MESSAGES.VALIDATION_ERROR,
            error: 'One or more team members do not exist'
          });
        }
      }

      // Create team members array with roles
      const teamMembersData = teamMembers.map(userId => ({
        user: userId,
        role: 'developer', // Default role
        joinedAt: new Date()
      }));

      // Add project manager as team member if not already included
      const pmExists = teamMembersData.some(member =>
        member.user.toString() === req.user._id.toString()
      );
      if (!pmExists) {
        teamMembersData.unshift({
          user: req.user._id,
          role: 'project_manager',
          joinedAt: new Date()
        });
      }

      const projectData = {
        name,
        description,
        projectManager: req.user._id,
        teamMembers: teamMembersData,
        endDate: new Date(endDate),
        priority,
        budget: budget ? {
          allocated: budget.allocated,
          currency: budget.currency || 'USD'
        } : undefined,
        tags,
        category,
        client
      };

      const project = new Project(projectData);
      await project.save();

      await project.populate([
        { path: 'projectManager', select: 'firstName lastName email' },
        { path: 'teamMembers.user', select: 'firstName lastName email designation' }
      ]);

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: { project }
      });
    } catch (error) {
      console.error('Create project error:', error);

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
        error: 'Failed to create project'
      });
    }
  }

  /**
   * Get all projects
   * GET /api/projects
   */
  static async getProjects(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        priority,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const { page: validPage, limit: validLimit, skip } = validatePagination(page, limit);

      let filter = {};

      if (status) filter.status = status;
      if (priority) filter.priority = priority;

      // Filter based on user role
      if (req.user.role === USER_ROLES.EMPLOYEE) {
        // Employees can only see projects they're part of
        filter['teamMembers.user'] = req.user._id;
      } else if (req.user.role === USER_ROLES.PROJECT_MANAGER) {
        // PMs can see projects they manage or are part of
        filter.$or = [
          { projectManager: req.user._id },
          { 'teamMembers.user': req.user._id }
        ];
      }
      // Admins can see all projects

      if (search) {
        filter.$or = [
          { name: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ];
      }

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [projects, total] = await Promise.all([
        Project.find(filter)
          .populate('projectManager', 'firstName lastName email')
          .populate('teamMembers.user', 'firstName lastName email designation')
          .sort(sort)
          .skip(skip)
          .limit(validLimit),
        Project.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / validLimit);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Projects retrieved successfully',
        data: {
          projects,
          pagination: {
            currentPage: validPage,
            totalPages,
            totalItems: total,
            itemsPerPage: validLimit
          }
        }
      });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve projects'
      });
    }
  }

  /**
   * Get project by ID
   * GET /api/projects/:id
   */
  static async getProjectById(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findById(id)
        .populate('projectManager', 'firstName lastName email')
        .populate('teamMembers.user', 'firstName lastName email designation phone')
        .populate('tasks');

      if (!project) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Project not found'
        });
      }

      // Check if user has access to this project
      if (req.user.role === USER_ROLES.EMPLOYEE) {
        const isTeamMember = project.teamMembers.some(member =>
          member.user._id.toString() === req.user._id.toString()
        );
        if (!isTeamMember) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
            error: 'You can only view projects you are part of'
          });
        }
      }

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Project retrieved successfully',
        data: { project }
      });
    } catch (error) {
      console.error('Get project error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve project'
      });
    }
  }

  /**
   * Update project
   * PUT /api/projects/:id
   */
  static async updateProject(req, res) {
    try {
      const { id } = req.params;
      const sanitizedData = sanitizeInput(req.body);

      const project = await Project.findById(id);
      if (!project) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Project not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          project.projectManager.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only update projects you manage'
        });
      }

      const updatedProject = await Project.findByIdAndUpdate(
        id,
        { ...sanitizedData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate([
        { path: 'projectManager', select: 'firstName lastName email' },
        { path: 'teamMembers.user', select: 'firstName lastName email designation' }
      ]);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: SUCCESS_MESSAGES.USER_UPDATED,
        data: { project: updatedProject }
      });
    } catch (error) {
      console.error('Update project error:', error);

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
        error: 'Failed to update project'
      });
    }
  }

  /**
   * Delete project
   * DELETE /api/projects/:id
   */
  static async deleteProject(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Project not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          project.projectManager.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only delete projects you manage'
        });
      }

      // Remove project reference from tasks
      await Task.updateMany(
        { project: id },
        { $unset: { project: 1 } }
      );

      await Project.findByIdAndDelete(id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Project deleted successfully',
        data: null
      });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to delete project'
      });
    }
  }

  /**
   * Add team member to project
   * POST /api/projects/:id/team-members
   */
  static async addTeamMember(req, res) {
    try {
      const { id } = req.params;
      const { userId, role = 'developer' } = req.body;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Project not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          project.projectManager.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only manage team members for projects you manage'
        });
      }

      await project.addTeamMember(userId, role);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Team member added successfully',
        data: { project }
      });
    } catch (error) {
      console.error('Add team member error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: error.message || 'Failed to add team member'
      });
    }
  }

  /**
   * Remove team member from project
   * DELETE /api/projects/:id/team-members
   */
  static async removeTeamMember(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Project not found'
        });
      }

      // Check permissions
      if (req.user.role !== USER_ROLES.ADMIN &&
          project.projectManager.toString() !== req.user._id.toString()) {
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          error: 'You can only manage team members for projects you manage'
        });
      }

      await project.removeTeamMember(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Team member removed successfully',
        data: { project }
      });
    } catch (error) {
      console.error('Remove team member error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: error.message || 'Failed to remove team member'
      });
    }
  }

  /**
   * Get project statistics
   * GET /api/projects/stats
   */
  static async getProjectStats(req, res) {
    try {
      const stats = await Project.getProjectStats();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Project statistics retrieved successfully',
        data: { stats }
      });
    } catch (error) {
      console.error('Get project stats error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve project statistics'
      });
    }
  }

  /**
   * Get project progress summary
   * GET /api/projects/:id/progress
   */
  static async getProjectProgress(req, res) {
    try {
      const { id } = req.params;

      const project = await Project.findById(id);
      if (!project) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          error: 'Project not found'
        });
      }

      // Check permissions
      if (req.user.role === USER_ROLES.EMPLOYEE) {
        const isTeamMember = project.teamMembers.some(member =>
          member.user.toString() === req.user._id.toString()
        );
        if (!isTeamMember) {
          return res.status(HTTP_STATUS.FORBIDDEN).json({
            success: false,
            message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
            error: 'You can only view progress for projects you are part of'
          });
        }
      }

      const progress = await Task.getProjectProgress(id);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Project progress retrieved successfully',
        data: { progress }
      });
    } catch (error) {
      console.error('Get project progress error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve project progress'
      });
    }
  }

  /**
   * Get overdue projects
   * GET /api/projects/overdue
   */
  static async getOverdueProjects(req, res) {
    try {
      const projects = await Project.getOverdueProjects();

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Overdue projects retrieved successfully',
        data: { projects }
      });
    } catch (error) {
      console.error('Get overdue projects error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: ERROR_MESSAGES.SERVER_ERROR,
        error: 'Failed to retrieve overdue projects'
      });
    }
  }
}

export default ProjectController;