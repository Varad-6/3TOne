// src/components/admin/reports/ProjectSummaryTable.jsx

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { Badge } from "../../ui/badge";
import { Loader2, FileX } from "lucide-react";

const PROJECT_STATUS_CONFIG = {
  "In Progress":
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  Planned: "bg-secondary text-secondary-foreground",
  Completed:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  "On Hold":
    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  Cancelled:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",
};

export function ProjectSummaryTable({ data = [], loading }) {
  if (!loading && data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
          <FileX className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">
            No project data found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {loading ? "Loading..." : `${data.length} projects`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Project
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Client
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Total Hours
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Billable
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Employees
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Tickets
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Working Days
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    First Entry
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Last Entry
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const billablePct =
                    row.total_hours > 0
                      ? Math.round((row.billable_hours / row.total_hours) * 100)
                      : 0;
                  const statusClass =
                    PROJECT_STATUS_CONFIG[row.project_status] ||
                    "bg-secondary text-secondary-foreground";

                  return (
                    <TableRow
                      key={row.project_id}
                      className="hover:bg-accent/50 transition-colors"
                    >
                      {/* Project */}
                      <TableCell>
                        <div className="font-medium text-sm">
                          {row.project_name}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit mt-0.5">
                          {row.project_code}
                        </div>
                      </TableCell>

                      {/* Client */}
                      <TableCell className="text-sm">
                        <div>{row.client_name || "—"}</div>
                        {row.client_code && (
                          <div className="text-xs text-muted-foreground">
                            {row.client_code}
                          </div>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusClass}`}
                        >
                          {row.project_status}
                        </Badge>
                      </TableCell>

                      {/* Total hours */}
                      <TableCell>
                        <span className="font-bold text-sm">
                          {parseFloat(row.total_hours).toFixed(1)}h
                        </span>
                      </TableCell>

                      {/* Billable */}
                      <TableCell>
                        <div className="text-sm">
                          {parseFloat(row.billable_hours).toFixed(1)}h
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {billablePct}%
                        </div>
                      </TableCell>

                      {/* Employees */}
                      <TableCell className="text-sm">
                        {row.total_employees}
                      </TableCell>

                      {/* Tickets */}
                      <TableCell className="text-sm">
                        {row.total_tickets}
                      </TableCell>

                      {/* Working days */}
                      <TableCell className="text-sm">
                        {row.working_days}
                      </TableCell>

                      {/* First entry */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.first_entry
                          ? new Date(row.first_entry).toLocaleDateString()
                          : "—"}
                      </TableCell>

                      {/* Last entry */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.last_entry
                          ? new Date(row.last_entry).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
