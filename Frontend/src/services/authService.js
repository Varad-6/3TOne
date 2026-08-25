import api from "./api";

class AuthService {
  // Normalize user shape to always expose { id, email, role, roleId, ... }
  normalizeUser(raw) {
    if (!raw || typeof raw !== "object") return null;

    // Try several common field names then fall back
    const role =
      raw.role ??
      raw.role_name ??
      raw.roleType ??
      null;

    const roleId =
      raw.roleId ??
      raw.role_id ??
      raw.roleID ??
      null;

    return {
      ...raw,
      role,
      roleId,
    };
  }

  // Login method
  async login(credentials) {
    const response = await api.post("/auth/login", credentials);

    if (response.data.accessToken) {
      const normalizedUser = this.normalizeUser(response.data.user);

      localStorage.setItem("accessToken", response.data.accessToken);
      localStorage.setItem("refreshToken", response.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
    }

    // Return the same shape the rest of the app expects
    return {
      ...response.data,
      user: this.normalizeUser(response.data.user),
    };
  }

  // Logout method
  async logout(refreshToken) {
    try {
      const rt =
        refreshToken ?? localStorage.getItem("refreshToken") ?? undefined;
      await api.post("/auth/logout", { refreshToken: rt });
    } catch {
      // ignore errors to keep logout idempotent
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
  }

  // Change password (unchanged)
  async changePassword(currentPassword, newPassword) {
    const response = await api.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // Get current user from localStorage (normalized to role + roleId)
  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;

    try {
      const parsed = JSON.parse(userStr);
      return this.normalizeUser(parsed);
    } catch {
      return null;
    }
  }

  // Get access token
  getAccessToken() {
    return localStorage.getItem("accessToken");
  }

  // Check authentication
  isAuthenticated() {
    return !!this.getAccessToken();
  }
}

export default new AuthService();
