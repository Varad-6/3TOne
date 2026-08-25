import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";
console.log("API URL:", API_URL); // Debug

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Create Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// 1. REQUEST INTERCEPTOR
// Add auth token and handle caching
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("accessToken");

    // Add auth token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Handle GET request caching
    if (config.method === "get" && !config.skipCache) {
      const cacheKey = `${config.url}${JSON.stringify(config.params || {})}`;
      const cachedResponse = cache.get(cacheKey);

      if (
        cachedResponse &&
        Date.now() - cachedResponse.timestamp < CACHE_DURATION
      ) {
        console.log("🎯 Cache hit:", {
          url: config.url,
          params: config.params,
          age: Math.round((Date.now() - cachedResponse.timestamp) / 1000) + "s",
        });

        // Return cached response by rejecting the promise with a specific object
        // This mimics a response error but carries valid data
        return Promise.reject({
          config,
          response: { data: cachedResponse.data, status: 200 },
          isCache: true,
        });
      } else {
        console.log("❌ Cache miss:", {
          url: config.url,
          params: config.params,
          reason: cachedResponse ? "expired" : "not found",
        });
      }
    }

    // Debug logging
    console.log("🔒 API Request:", {
      url: config.url,
      method: config.method,
      cached: false,
      token: token ? token.substring(0, 20) + "..." : "none",
    });

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 2. RESPONSE INTERCEPTOR
// Handle token refresh, caching, and retries
api.interceptors.response.use(
  (response) => {
    // 1. Cache successful GET responses
    if (response.config.method === "get" && !response.config.skipCache) {
      const cacheKey = `${response.config.url}${JSON.stringify(
        response.config.params || {}
      )}`;
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }

    // 2. Auto-Clear Cache on Mutation (POST, PUT, DELETE, PATCH)
    // This ensures lists are refreshed immediately after any data change
    if (["post", "put", "delete", "patch"].includes(response.config.method)) {
      console.log(
        `♻️ Mutation detected (${response.config.method.toUpperCase()}), clearing cache...`
      );
      clearCache();
    }

    return response;
  },
  async (error) => {
    // Return cached response if this error is from our cache handler (Request Interceptor)
    if (error.isCache) {
      console.log("🔄 Returning cached response for:", error.config.url);
      return error.response;
    }

    const originalRequest = error.config;

    // ✅ SKIP REFRESH LOGIC FOR LOGIN/AUTH ENDPOINTS
    // If login fails with 401/403, simply return the error to the UI component
    if (originalRequest.url.includes("/auth/login")) {
      return Promise.reject(error);
    }

    // ---------------------------------------------------------
    // TOKEN REFRESH LOGIC (Handles 401 AND 403)
    // ---------------------------------------------------------
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true; // Mark as retried to prevent infinite loops

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        console.log("🔄 Attempting token refresh...");

        // Use standard axios to avoid interceptor loops during refresh
        // Update URL if your backend route is different (e.g., /auth/refresh)
        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Update Storage
        localStorage.setItem("accessToken", accessToken);
        // Some backends rotate refresh tokens, some don't. Save if provided.
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }

        console.log("✅ Token refreshed successfully");

        // Update headers for future requests
        api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

        // Update header for THIS retried request
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;

        // Retry the original request with the new token
        // Using axios(originalRequest) ensures a clean retry
        return axios(originalRequest);
      } catch (refreshError) {
        console.error("❌ Refresh failed, logging out:", refreshError);

        // Clear everything
        localStorage.clear();
        clearCache(); // Clear API cache

        // Redirect to login
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    // ---------------------------------------------------------
    // RATE LIMIT HANDLING (429)
    // ---------------------------------------------------------
    // if (error.response?.status === 429) {
    //   const retryAfter = error.response.headers["retry-after"] || 5;
    //   console.log(`⏳ Rate limited. Retrying after ${retryAfter} seconds...`);

    //   // Dispatch event for UI notification (optional)
    //   const rateLimitEvent = new CustomEvent("api-rate-limit", {
    //     detail: { retryAfter, url: originalRequest.url },
    //   });
    //   window.dispatchEvent(rateLimitEvent);

    //   // Wait
    //   await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

    //   // Dispatch event when retry is happening
    //   const retryEvent = new CustomEvent("api-retry", {
    //     detail: { url: originalRequest.url },
    //   });
    //   window.dispatchEvent(retryEvent);

    //   // Retry
    //   return api(originalRequest);
    // }

    // Standard error return
    return Promise.reject(error);
  }
);

// Cache control methods
const clearCache = (pattern) => {
  if (pattern) {
    // Clear specific cache entries matching the pattern
    const keys = [...cache.keys()];
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        cache.delete(key);
        console.log("🧹 Cleared cache for:", key);
      }
    });
  } else {
    // Clear all cache
    cache.clear();
    console.log("🧹 Cleared all cache");
  }
};

// Export both the API instance and cache control
export { clearCache };
export default api;
