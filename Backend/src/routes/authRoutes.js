import express from "express";
import * as authController from "../controllers/authController.js";
import { authenticateToken ,authorizeRoles} from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes (no auth)
router.post("/login", authController.login);
router.post("/refresh", authController.refreshToken);

// Protected routes (require auth)
router.post("/logout", authenticateToken, authController.logout);
router.post("/change-password", authenticateToken, authController.changePassword);

export default router;
