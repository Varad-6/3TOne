// utils/validators.js
import { body } from "express-validator";

// ------------------------------------
// Reusable Regex Patterns
// ------------------------------------
export const REGEX = {
  PHONE: /^\d{10}$/,
  NAME: /^[A-Za-z\s\-']+$/, // Letters, spaces, hyphens, apostrophes
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/,
  EMP_ID: /^EMP\d{3}$/,
  PRJ_ID: /^PRJ\d{3}$/,
  CLI_ID: /^CLI\d{3}$/,
  ACT_ID: /^ACT\d{3}$/,
};

// ------------------------------------
// Helper Functions (Pure Logic)
// ------------------------------------
export const sanitizeUrl = (url) => {
  if (url && !url.startsWith("http")) {
    return "https://" + url;
  }
  return url;
};

// ------------------------------------
// Validation Rule Sets (Schemas)
// ------------------------------------

// 1. Login
export const validateLoginRules = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// 2. Employee
export const validateEmployeeCreateRules = [
  body("firstName")
    .trim()
    .matches(REGEX.NAME)
    .withMessage("First name must contain only characters"),
  body("lastName")
    .trim()
    .matches(REGEX.NAME)
    .withMessage("Last name must contain only characters"),
  body("email").trim().isEmail().withMessage("Invalid email format"),
  body("password")
    .matches(REGEX.PASSWORD)
    .withMessage(
      "Password must be at least 12 chars, with 1 uppercase, 1 lowercase, 1 number, and 1 special char"
    ),
  body("phoneNumber")
    .trim()
    .matches(REGEX.PHONE)
    .withMessage("Phone number must be exactly 10 digits"),
  body("department")
    .trim()
    .matches(REGEX.NAME)
    .withMessage("Department must contain only characters"),
  body("designation")
    .trim()
    .matches(REGEX.NAME)
    .withMessage("Designation must contain only characters"),
  body("role").isIn(["MANAGER", "EMPLOYEE"]).withMessage("Invalid role"),
  body("doj").isISO8601().withMessage("Valid date of joining is required"),
];

export const validateEmployeeUpdateRules = [
  body("firstName").optional().trim().matches(REGEX.NAME),
  body("lastName").optional().trim().matches(REGEX.NAME),
  body("email").optional().trim().isEmail(),
  body("phoneNumber").optional().trim().matches(REGEX.PHONE),
  body("department").optional().trim().matches(REGEX.NAME),
  body("designation").optional().trim().matches(REGEX.NAME),
  body("role").optional().isIn(["ADMIN", "MANAGER", "EMPLOYEE"]),
];

// 3. Client Validation Rules (ALL FIELDS MANDATORY)
export const validateClientCreateRules = [
  // Client Basic Details
  body("clientName")
    .trim()
    .notEmpty()
    .withMessage("Client Name is required")
    .matches(REGEX.ALPHANUMERIC)
    .withMessage("Client Name must be alphanumeric"),

  body("clientCode").trim().notEmpty().withMessage("Client Code is required"),

  body("zohoCrmCode")
    .trim()
    .notEmpty()
    .withMessage("Zoho CRM Code is required"),

  body("alias")
    .trim()
    .notEmpty()
    .withMessage("Alias is required")
    .matches(REGEX.ALPHANUMERIC)
    .withMessage("Alias must be alphanumeric"),

  // SPOC Details (Mandatory)
  body("spocName")
    .trim()
    .notEmpty()
    .withMessage("SPOC Name is required")
    .matches(REGEX.NAME)
    .withMessage("SPOC Name must contain only characters"),

  body("clientSpocEmail") // Matches controller field
    .trim()
    .notEmpty()
    .withMessage("SPOC Email is required")
    .isEmail()
    .withMessage("Invalid SPOC Email format"),

  body("clientSpocPhone") // Matches controller field
    .trim()
    .notEmpty()
    .withMessage("SPOC Phone is required")
    .matches(REGEX.PHONE)
    .withMessage("SPOC Phone must be exactly 10 digits"),

  body("url")
    .trim()
    .notEmpty()
    .withMessage("Website URL is required")
    .customSanitizer(sanitizeUrl)
    .isURL()
    .withMessage("Invalid website URL format"),
];

// 4. Project
export const validateProjectCreateRules = [
  body("projectName")
    .trim()
    .matches(REGEX.ALPHANUMERIC)
    .withMessage("Project name must be alphanumeric"),
  body("projectCode").trim().notEmpty().withMessage("Project code is required"),
  body("clientId").notEmpty().withMessage("Client ID is required"),
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("projectUrl").optional().trim().customSanitizer(sanitizeUrl).isURL(),
];

// 5. Activity
export const validateActivityCreateRules = [
  body("activityName")
    .trim()
    .matches(REGEX.ALPHANUMERIC)
    .withMessage("Activity name must be alphanumeric"),
  body("activityCode")
    .trim()
    .notEmpty()
    .withMessage("Activity code is required"),
];

// 6. Timesheet
export const validateTimesheetCreateRules = [
  body("weekStartDate").isISO8601().withMessage("Valid start date is required"),
  body("weekEndDate").isISO8601().withMessage("Valid end date is required"),
  body("entries")
    .isArray({ min: 1 })
    .withMessage("At least one entry is required"),
  body("entries.*.entryDate")
    .isISO8601()
    .withMessage("Entry date must be valid"),
  body("entries.*.hours")
    .isFloat({ min: 0, max: 24 })
    .withMessage("Hours must be between 0 and 24"),
  body("entries.*.description")
    .optional()
    .trim()
    .isLength({ min: 5 })
    .withMessage("Description must be at least 5 characters"),
];
