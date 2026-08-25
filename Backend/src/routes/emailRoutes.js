// src/routes/emailRoutes.js
import express from "express";
import { healthCheck, verifySmtp } from "../controllers/emailController.js";

const router = express.Router();

// GET /api/email/health           — check SMTP config status
// GET /api/email/verify-connection — live SMTP ping test
router.get("/health", healthCheck);
router.get("/verify-connection", verifySmtp);

export default router;
