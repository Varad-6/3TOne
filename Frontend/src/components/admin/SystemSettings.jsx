import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save } from "lucide-react";
// import settingsService from "@/services/settingsService";

export  function SystemSettings() {
  const [settings, setSettings] = useState({
    max_hours_per_day: "8",
    max_hours_per_week: "40",
    working_days_per_week: "5",
    allow_overtime: false,
    timesheet_submission_reminder: true,
    email_notifications_enabled: true,
    approval_required: true,
    auto_approve_within_hours: "24",
  });

  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);
      // await settingsService.updateSettings(settings);
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide preferences
        </p>
      </div>

      <Tabs defaultValue="working-hours">
        <TabsList>
          <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="approval">Approval</TabsTrigger>
        </TabsList>

        {/* --- Working Hours --- */}
        <TabsContent value="working-hours" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Working Hours Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Hours Per Day</Label>
                  <Input
                    type="number"
                    value={settings.max_hours_per_day}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_hours_per_day: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Hours Per Week</Label>
                  <Input
                    type="number"
                    value={settings.max_hours_per_week}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        max_hours_per_week: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Working Days Per Week</Label>
                <Input
                  type="number"
                  value={settings.working_days_per_week}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      working_days_per_week: e.target.value,
                    })
                  }
                  className="max-w-xs"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Overtime</Label>
                  <p className="text-sm text-muted-foreground">
                    Permit employees to log more than standard hours
                  </p>
                </div>
                <Switch
                  checked={settings.allow_overtime}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, allow_overtime: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Notifications --- */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications for important events
                  </p>
                </div>
                <Switch
                  checked={settings.email_notifications_enabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      email_notifications_enabled: checked,
                    })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Timesheet Submission Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Remind employees to submit timesheets weekly
                  </p>
                </div>
                <Switch
                  checked={settings.timesheet_submission_reminder}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      timesheet_submission_reminder: checked,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Approval Workflow --- */}
        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Approval</Label>
                  <p className="text-sm text-muted-foreground">
                    All timesheets must be approved by a manager
                  </p>
                </div>
                <Switch
                  checked={settings.approval_required}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, approval_required: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Auto-Approve After (hours)</Label>
                <Input
                  type="number"
                  value={settings.auto_approve_within_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      auto_approve_within_hours: e.target.value,
                    })
                  }
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Automatically approve if no action taken within specified
                  hours
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
