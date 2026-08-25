import express from 'express';
import * as auditController from '../controllers/auditController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles(['ADMIN']));

router.get('/', auditController.getAuditLogs);
router.get('/export', auditController.exportAuditLogs);
router.get('/:id', auditController.getAuditLogById);

export default router;