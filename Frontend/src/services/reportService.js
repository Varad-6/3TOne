import api from "./api";

export const reportService = {
  getAdminOverview: async (params) => {
    // params may include roleId, departmentId, statusId, date ranges, etc.
    const response = await api.get("/reports/admin-overview", { params });
    return response.data;
  },

  getTeamReport: async (params) => {
    const response = await api.get("/reports/team-report", { params });
    return response.data;
  },

  getEmployeeSummary: async (params) => {
    const response = await api.get("/reports/employee-summary", { params });
    return response.data;
  },

  exportReport: async (params) => {
    const response = await api.get("/reports/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  getUtilizationReport: async (params) => {
    const response = await api.get("/reports/utilization", { params });
    return response.data;
  },
};
