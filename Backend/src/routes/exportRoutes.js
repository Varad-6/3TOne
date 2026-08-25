// src/routes/exportRoutes.js
import express from 'express';
import { exportData, exportAll } from '../controllers/exportController.js';
import {authenticateToken} from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleAuthMiddleware.js';

const router = express.Router();

// All tables: /api/export/all
router.get('/all', authenticateToken, authorize('ADMIN'), exportAll);
// Single table export: /api/export/employees, /api/export/clients, etc.
router.get('/:type', authenticateToken, authorize('ADMIN'), exportData);

export default router;
