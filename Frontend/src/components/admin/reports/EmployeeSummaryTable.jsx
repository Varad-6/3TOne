// src/components/admin/reports/EmployeeSummaryTable.jsx

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
import { Avatar, AvatarFallback } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { Loader2, FileX, TrendingUp, TrendingDown } from "lucide-react";

function getInitials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function EmployeeSummaryTable({ data = [], loading }) {
  if (!loading && data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
          <FileX className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">
            No employee data found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {loading ? "Loading..." : `${data.length} employees`}
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
                    Employee
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Department
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Manager
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Total Hours
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Billable
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Working Days
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Avg / Day
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Projects
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">
                    Status
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

                  return (
                    <TableRow
                      key={row.employee_id}
                      className="hover:bg-accent/50 transition-colors"
                    >
                      {/* Employee */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                              {getInitials(row.employee_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {row.employee_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.employee_code} · {row.designation || "—"}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Department */}
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.department || "—"}
                        </Badge>
                      </TableCell>

                      {/* Manager */}
                      <TableCell className="text-sm text-muted-foreground">
                        {row.manager_name || "—"}
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

                      {/* Working days */}
                      <TableCell className="text-sm">
                        {row.working_days}
                      </TableCell>

                      {/* Avg per day */}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          {parseFloat(row.avg_hours_per_day).toFixed(1)}h
                          {parseFloat(row.avg_hours_per_day) >= 8 ? (
                            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                        </div>
                      </TableCell>

                      {/* Projects */}
                      <TableCell className="text-sm">
                        {row.total_projects}
                      </TableCell>

                      {/* Status breakdown */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {row.approved_count} approved
                          </span>
                          {row.pending_count > 0 && (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              ⏳ {row.pending_count} pending
                            </span>
                          )}
                          {row.rejected_count > 0 && (
                            <span className="text-destructive">
                              ✗ {row.rejected_count} rejected
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Last entry */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.last_entry_date
                          ? new Date(row.last_entry_date).toLocaleDateString()
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
