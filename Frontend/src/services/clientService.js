import api from "./api";

class ClientService {
  /**
   * Get all clients
   */
  async getAllClients() {
    const response = await api.get("/clients");
    return response.data;
  }

  /**
   * Get a single client by ID
   */
  async getClientById(id) {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  }

  /**
   * Create a new client
   */
  async createClient(data) {
    const response = await api.post("/clients", data);
    return response.data.client;
  }

  /**
   * Update an existing client
   */
  async updateClient(id, data) {
    const response = await api.put(`/clients/${id}`, data);
    return response.data.client;
  }

  /**
   * Delete a client (soft delete)
   */
  async deleteClient(id) {
    await api.delete(`/clients/${id}`);
  }

  /**
   * ✅ NEW: Reactivate an inactive client
   * This will set is_active = TRUE
   */
  async reactivateClient(id) {
    const response = await api.patch(`/clients/${id}/reactivate`);
    return response.data;
  }
}

export default new ClientService();
