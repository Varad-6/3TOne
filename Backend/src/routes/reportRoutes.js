import express from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply auth to all routes
router.use(authenticateToken);

// Admin overview report
router.get('/admin/overview', authorizeRoles(['ADMIN']), reportController.getAdminOverview);

// Manager team report (uses getTeamReport)
router.get('/manager/team', authorizeRoles(['MANAGER', 'ADMIN']), reportController.getTeamReport);

// Employee summary report
router.get('/employee/summary', reportController.getEmployeeSummary);

// Export report
router.get('/export', reportController.exportReport);

// Utilization report
router.get('/utilization', authorizeRoles(['ADMIN', 'MANAGER']), reportController.getUtilizationReport);

export default router;
