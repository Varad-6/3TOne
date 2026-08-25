/**
 * Protected Admin Configuration
 * Super admin that cannot be deleted or deactivated
 */

export const PROTECTED_ADMIN_EMAIL = process.env.PROTECTED_ADMIN_EMAIL || 'admin@company.com';
export const PROTECTED_ADMIN_ID = process.env.PROTECTED_ADMIN_ID || '1';