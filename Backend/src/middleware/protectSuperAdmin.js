import { PROTECTED_ADMIN_ID } from '../config/protectedAccounts.js';

/**
 * Middleware to prevent deletion/deactivation of protected admin
 */
const protectSuperAdmin = (req, res, next) => {
  const targetEmployeeId = req.params.id;
  
  // Check if trying to modify protected admin
  if (
    targetEmployeeId === PROTECTED_ADMIN_ID || 
    targetEmployeeId === parseInt(PROTECTED_ADMIN_ID)
  ) {
    return res.status(403).json({
      error: 'Cannot delete or deactivate the super admin account',
      protected: true
    });
  }
  
  next();
};

export default protectSuperAdmin;
