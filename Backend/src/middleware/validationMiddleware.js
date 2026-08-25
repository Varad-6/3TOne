// middleware/validationMiddleware.js
import { validationResult } from "express-validator";
import {
  validateLoginRules,
  validateEmployeeCreateRules,
  validateEmployeeUpdateRules,
  validateClientCreateRules,
  validateProjectCreateRules,
  validateActivityCreateRules,
  validateTimesheetCreateRules,
} from "../utils/validators.js";

/**
 * Universal Validation Runner
 * Checks for errors from the configured rules and returns 400 if any exist.
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// Export combined middlewares for Routes to use directly:
// Usage in routes: router.post('/login', validateLogin, authController.login);

export const validateLogin = [...validateLoginRules, validate];
export const validateEmployeeCreate = [
  ...validateEmployeeCreateRules,
  validate,
];
export const validateEmployeeUpdate = [
  ...validateEmployeeUpdateRules,
  validate,
];
export const validateClientCreate = [...validateClientCreateRules, validate];
export const validateProjectCreate = [...validateProjectCreateRules, validate];
export const validateActivityCreate = [
  ...validateActivityCreateRules,
  validate,
];
export const validateTimesheetCreate = [
  ...validateTimesheetCreateRules,
  validate,
];
