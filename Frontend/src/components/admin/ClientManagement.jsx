import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  AlertTriangle,
  ArchiveRestore,
  Eye,
  X,
} from "lucide-react";
import clientService from "../../services/clientService";

const initialFormState = {
  clientName: "",
  clientCode: "",
  zohoCrmCode: "",
  alias: "",
  spocName: "",
  clientSpocEmail: "",
  clientSpocPhone: "",
  url: "",
};

export function ClientManagement() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [viewingClient, setViewingClient] = useState(null);
  const [deactivatingClient, setDeactivatingClient] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState(initialFormState);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await clientService.getAllClients();
      setClients(data.clients || []);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
      toast.error(error?.response?.data?.message || "Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const validateForm = () => {
    if (!formData.clientName.trim()) {
      toast.error("Client Name is required");
      return false;
    }
    if (!formData.clientCode.trim()) {
      toast.error("Client Code is required");
      return false;
    }
    if (!formData.zohoCrmCode.trim()) {
      toast.error("Zoho CRM Code is required");
      return false;
    }
    if (!formData.alias.trim()) {
      toast.error("Alias is required");
      return false;
    }
    if (!formData.spocName.trim()) {
      toast.error("SPOC Name is required");
      return false;
    }
    if (!formData.clientSpocEmail.trim()) {
      toast.error("SPOC Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientSpocEmail)) {
      toast.error("Invalid SPOC Email format");
      return false;
    }
    if (!formData.clientSpocPhone.trim()) {
      toast.error("SPOC Phone is required");
      return false;
    }
    if (!/^\d{10}$/.test(formData.clientSpocPhone)) {
      toast.error("SPOC Phone must be exactly 10 digits");
      return false;
    }
    if (!formData.url.trim()) {
      toast.error("Website URL is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);

      if (editingClient) {
        await clientService.updateClient(editingClient.client_id, formData);
        toast.success("Client updated successfully");
      } else {
        await clientService.createClient(formData);
        toast.success("Client created successfully");
      }

      setShowDialog(false);
      resetForm();
      await fetchClients();
    } catch (error) {
      console.error("Failed to save client:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to save client";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleView = (client) => {
    setViewingClient(client);
    setShowViewDialog(true);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      clientName: client.client_name,
      clientCode: client.client_code,
      zohoCrmCode: client.zoho_crm_code,
      alias: client.alias || "",
      spocName: client.spoc_name || "",
      clientSpocEmail: client.spoc_email || "",
      clientSpocPhone: client.spoc_phone || "",
      url: client.url || "",
    });
    setShowDialog(true);
  };

  const confirmDeactivation = (client) => {
    setDeactivatingClient(client);
    setShowDeactivateDialog(true);
  };

  const handleDeactivateSubmit = async () => {
    if (!deactivatingClient) return;
    try {
      setSubmitting(true);
      await clientService.deleteClient(deactivatingClient.client_id);
      toast.success("Client deactivated successfully");
      setShowDeactivateDialog(false);
      setDeactivatingClient(null);
      await fetchClients();
    } catch (error) {
      console.error("Failed to deactivate:", error);
      const msg = error?.response?.data?.error || "Failed to deactivate client";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async (client) => {
    if (
      !window.confirm(
        `Are you sure you want to reactivate ${client.client_name}?`
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      await clientService.reactivateClient(client.client_id);
      toast.success("Client reactivated successfully");
      await fetchClients();
    } catch (error) {
      console.error("Failed to reactivate client:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to reactivate client";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData(initialFormState);
  };

  const handleDialogClose = (open) => {
    if (!open && !submitting) {
      setShowDialog(false);
      resetForm();
    }
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.client_name.toLowerCase().includes(searchLower) ||
      client.client_code?.toLowerCase().includes(searchLower) ||
      client.zoho_crm_code?.toLowerCase().includes(searchLower) ||
      (client.alias && client.alias.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          {/* <p className="text-muted-foreground">Manage client information</p> */}
        </div>
        <Button
          className="mr-2"
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full min-w-0">
        <CardHeader>
          <CardTitle>Clients ({filteredClients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Client Name</TableHead>
                  {/* <TableHead className="w-[25%]">Zoho CRM Code</TableHead> */}
                  <TableHead className="w-[20%]">SPOC Name</TableHead>
                  <TableHead className="w-[25%]">SPOC Email</TableHead>
                  <TableHead className="w-[10%]">URL</TableHead>
                  <TableHead className="w-[15%] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Loading clients...
                      </p>
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {searchQuery
                        ? "No clients found matching your filter"
                        : "No clients found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow
                      key={client.client_id}
                      className={
                        !client.is_active ? "bg-muted/50 opacity-60" : ""
                      }
                    >
                      <TableCell className="font-medium">
                        {client.client_name}
                        {!client.is_active && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs rounded-full"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      {/* <TableCell className="">
                        <Badge className="font-medium">
                          {client.zoho_crm_code}
                        </Badge>
                      </TableCell> */}
                      <TableCell className="">
                        {client.spoc_name || "-"}
                      </TableCell>
                      <TableCell className="">
                        {client.spoc_email || "-"}
                      </TableCell>
                      <TableCell className="">
                        {client.url ? (
                          <a
                            href={client.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700  text-sm"
                          >
                            Visit
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-2">
                          {client.is_active ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(client)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(client)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => confirmDeactivation(client)}
                                title="Deactivate"
                              >
                                <Trash2 className="h-4 w-4 text-destructive text-red-600" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReactivate(client)}
                              title="Reactivate Client"
                            >
                              <ArchiveRestore className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/*View Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{viewingClient?.client_name}</DialogTitle>
            {/* <DialogDescription>Client details</DialogDescription> */}
          </DialogHeader>
          {viewingClient && (
            <div className="space-y-3 mt-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Zoho Code:
                </span>
                <span>{viewingClient.zoho_crm_code || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Client Code:
                </span>
                <span>{viewingClient.client_code || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Alias:
                </span>
                <span>{viewingClient.alias || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Status:
                </span>
                <Badge
                  className={
                    viewingClient.is_active
                      ? "bg-blue-500 hover:bg-blue-600 text-white rounded-full"
                      : "bg-gray-500 hover:bg-gray-600 text-white rounded-full"
                  }
                >
                  {viewingClient.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">URL:</span>
                <span>
                  {viewingClient.url ? (
                    <a
                      href={viewingClient.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 underline"
                    >
                      {viewingClient.url}
                    </a>
                  ) : (
                    "-"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-muted-foreground">
                  Created Date:
                </span>
                <span>
                  {viewingClient.created_at
                    ? new Date(viewingClient.created_at).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )
                    : "-"}
                </span>
              </div>

              {/* SPOC Details Section */}
              <div className="border-t pt-3 mt-3">
                <span className="font-semibold text-sm block mb-2">
                  SPOC Details:
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">
                      Name:
                    </span>
                    <span>{viewingClient.spoc_name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">
                      Email:
                    </span>
                    <span>{viewingClient.spoc_email || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-muted-foreground">
                      Phone:
                    </span>
                    <span>{viewingClient.spoc_phone || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="default"  onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Edit Client" : "Create New Client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update client details below"
                : "All fields are mandatory to add a new client"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Client Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                  placeholder="Enter Client Name"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Alias <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.alias}
                  onChange={(e) =>
                    setFormData({ ...formData, alias: e.target.value })
                  }
                  placeholder="Enter Alias"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Client Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.clientCode}
                  onChange={(e) =>
                    setFormData({ ...formData, clientCode: e.target.value })
                  }
                  placeholder="Enter Code"
                  disabled={submitting || editingClient}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Zoho CRM Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.zohoCrmCode}
                  onChange={(e) =>
                    setFormData({ ...formData, zohoCrmCode: e.target.value })
                  }
                  placeholder="Enter Zoho ID"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Website URL <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder="https://example.com"
                disabled={submitting}
                type="url"
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium mb-4">SPOC Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.spocName}
                    onChange={(e) =>
                      setFormData({ ...formData, spocName: e.target.value })
                    }
                    placeholder="SPOC Name"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={formData.clientSpocEmail}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        clientSpocEmail: e.target.value,
                      })
                    }
                    placeholder="spoc@example.com"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Contact Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.clientSpocPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        clientSpocPhone: e.target.value,
                      })
                    }
                    placeholder="10-digit Mobile"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>{editingClient ? "Update" : "Create"} Client</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog
        open={showDeactivateDialog}
        onOpenChange={(open) => !submitting && setShowDeactivateDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Deactivate Client
            </DialogTitle>
            <DialogDescription>
              Are you sure? This will prevent new projects for this client.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
