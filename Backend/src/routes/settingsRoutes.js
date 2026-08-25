import express from 'express';
import * as settingsController from "../controllers/settingsController.js";
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles(['ADMIN']));

router.get('/', settingsController.getSettings);
router.put('/', settingsController.bulkUpdateSettings);
router.put('/setting', settingsController.updateSetting);
router.get('/working-hours-policy', settingsController.getWorkingHoursPolicy);

export default router;
