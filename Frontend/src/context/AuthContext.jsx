import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../services/authService";
import { clearCache } from "../services/api";
import { toast } from "sonner";

const TOKEN_KEYS = {
  access: "accessToken",
  refresh: "refreshToken",
  user: "currentUser",
};

// Export Context as a named export
export const AuthContext = createContext(undefined);

/**
 * Normalize user object from backend so that:
 * - user.role is always a string name ("ADMIN" / "MANAGER" / "EMPLOYEE")
 * - user.roleId keeps the numeric FK (if present)
 * - same for department / departmentId
 * - derived flags: isAdmin / isManager / isEmployee
 */
function normalizeUser(raw) {
  if (!raw) return null;

  // Try to detect fields the backend might be sending
  const roleName =
    raw.roleName ||
    raw.role_name ||
    (typeof raw.role === "string" ? raw.role : null);

  const roleId =
    raw.roleId ??
    raw.role_id ??
    (typeof raw.role === "number" ? raw.role : null);

  const departmentName =
    raw.departmentName ||
    raw.department_name ||
    (typeof raw.department === "string" ? raw.department : null);

  const departmentId =
    raw.departmentId ??
    raw.department_id ??
    (typeof raw.department === "number" ? raw.department : null);

  const normalizedRole = roleName ? String(roleName).toUpperCase() : null;
  const normalizedDept = departmentName
    ? String(departmentName).toUpperCase()
    : null;

  const isAdmin = normalizedRole === "ADMIN";
  const isManager = normalizedRole === "MANAGER";
  const isEmployee = normalizedRole === "EMPLOYEE";

  return {
    ...raw,
    role: normalizedRole,
    roleId,
    department: normalizedDept,
    departmentId,
    isAdmin,
    isManager,
    isEmployee,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate(); // ← Added for logout navigation

  // Rehydrate from localStorage on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOKEN_KEYS.user);
      if (raw) {
        const parsedUser = JSON.parse(raw);
        const normalized = normalizeUser(parsedUser);
        console.log("🔐 Auth initialized with user:", normalized);
        setUser(normalized);
      } else {
        console.log("🔐 No user found in localStorage");
      }
    } catch (error) {
      console.error("❌ Error parsing user from localStorage:", error);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      console.log("🔑 Attempting login for:", credentials.email);

      // Clear cache before login to ensure fresh state
      clearCache();

      const response = await authService.login(credentials);
      const { accessToken, refreshToken, user: loggedUser } = response || {};

      if (!accessToken || !refreshToken || !loggedUser) {
        throw new Error("Invalid login response: missing tokens or user");
      }

      const normalizedUser = normalizeUser(loggedUser);

      console.log("✅ Login successful for user:", normalizedUser);
      console.log(
        "🎭 User role:",
        normalizedUser.role,
        "Type:",
        typeof normalizedUser.role
      );

      localStorage.setItem(TOKEN_KEYS.access, accessToken);
      localStorage.setItem(TOKEN_KEYS.refresh, refreshToken);
      localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(normalizedUser));

      setUser(normalizedUser);
      // toast.success("Login successful!");
      return normalizedUser; // ← ADD THIS LINE
    } catch (error) {
      console.error("❌ Login error:", error);
      // const message =
      //   error?.response?.data?.error || error?.message || "Login failed";
      // toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    console.log("🚪 Logout called");
    try {
      const rt = localStorage.getItem(TOKEN_KEYS.refresh) || undefined;
      await authService.logout(rt);
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      // Clear all tokens and user data
      localStorage.removeItem(TOKEN_KEYS.access);
      localStorage.removeItem(TOKEN_KEYS.refresh);
      localStorage.removeItem(TOKEN_KEYS.user);

      // Clear API Cache on Logout
      clearCache();

      setUser(null);
      console.log("✅ Logout complete, localStorage and Cache cleared");
      // ============================================
      // STEP 2: Navigate to login with replace
      // This removes the logout action from history
      // ============================================
      navigate("/login", { replace: true });

      // ============================================
      // STEP 3: Block browser back button
      // Push login state to create a barrier
      // ============================================
      window.history.pushState(null, "", "/login");

      // Add temporary listener to block back navigation
      const blockBack = (e) => {
        window.history.pushState(null, "", "/login");
      };

      window.addEventListener("popstate", blockBack);

      // Remove listener after 100ms
      // (User won't press back that fast)
      setTimeout(() => {
        window.removeEventListener("popstate", blockBack);
      }, 100);

      toast.success("Logged out successfully!");
      // toast.warning("Logged out successfully");
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    // Convenience accessors for role-based checks
    isAdmin: !!user?.isAdmin,
    isManager: !!user?.isManager,
    isEmployee: !!user?.isEmployee,
  };

  useEffect(() => {
    if (user) {
      console.log("👤 Current user:", user);
      console.log("🎭 Current role:", user.role);
    }
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

// ❌ No default export to avoid HMR issues
