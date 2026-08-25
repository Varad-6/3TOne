// src/components/admin/reports/ReportSummaryCards.jsx

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Clock,
  Users,
  FolderOpen,
  Ticket,
  CalendarDays,
  TrendingUp,
  CheckCircle,
  XCircle,
  DollarSign,
  FileText,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DB stores total_hours, billable_hours, non_billable_hours, avgHoursPerDay
// as INTEGER MINUTES. Divide by 60 before display.
// ─────────────────────────────────────────────────────────────────────────────
function minsToHours(minutes) {
  const m = parseFloat(minutes) || 0;
  return m / 60;
}

function formatHours(minutes) {
  if (minutes === undefined || minutes === null) return "—";
  return `${minsToHours(minutes).toFixed(1)}h`;
}

function percentage(part, total) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClass = "text-muted-foreground",
  loading,
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportSummaryCards({ summary, loading }) {
  if (!summary && !loading) return null;

  const total = summary?.totalEntries || 0;
  const pct = (n) =>
    total > 0 ? `${Math.round(((n ?? 0) / total) * 100)}%` : "0%";

  return (
    <>
      {/* ── Row 1: core metrics ────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          icon={Clock}
          label="Total Hours"
          value={formatHours(summary?.totalHours)}
          sub={`Avg ${formatHours(summary?.avgHoursPerDay)} / day`}
          loading={loading}
        />
        <SummaryCard
          icon={DollarSign}
          label="Billable Hours"
          value={formatHours(summary?.billableHours)}
          sub={`${percentage(summary?.billableHours, summary?.totalHours)} billable`}
          iconClass="text-green-500"
          loading={loading}
        />
        <SummaryCard
          icon={DollarSign}
          label="Non-Billable Hours"
          value={formatHours(summary?.nonBillableHours)}
          sub={`${percentage(summary?.nonBillableHours, summary?.totalHours)} non-billable`}
          iconClass="text-red-500"
          loading={loading}
        />
        <SummaryCard
          icon={Users}
          label="Employees"
          value={summary?.totalEmployees ?? "—"}
          sub={`${summary?.workingDays ?? 0} working days`}
          loading={loading}
        />
        <SummaryCard
          icon={FolderOpen}
          label="Projects"
          value={summary?.totalProjects ?? "—"}
          sub={`${summary?.totalTickets ?? 0} tickets`}
          loading={loading}
        />
      </div>

      {/* ── Row 2: status breakdown ────────────────────────────────────── */}
      {summary?.statusBreakdown && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mt-4">
          <SummaryCard
            icon={CalendarDays}
            label="Total Entries"
            value={summary.totalEntries ?? 0}
            sub="All statuses"
            iconClass="text-blue-500"
            loading={loading}
          />
          <SummaryCard
            icon={CheckCircle}
            label="Approved"
            value={summary.statusBreakdown.approved ?? 0}
            sub={pct(summary.statusBreakdown.approved)}
            iconClass="text-green-500"
            loading={loading}
          />
          <SummaryCard
            icon={TrendingUp}
            label="Submitted"
            value={summary.statusBreakdown.submitted ?? 0}
            sub={pct(summary.statusBreakdown.submitted)}
            iconClass="text-blue-500"
            loading={loading}
          />
          <SummaryCard
            icon={Clock}
            label="Draft"
            value={summary.statusBreakdown.draft ?? 0}
            sub={pct(summary.statusBreakdown.draft)}
            iconClass="text-muted-foreground"
            loading={loading}
          />
          <SummaryCard
            icon={XCircle}
            label="Rejected"
            value={summary.statusBreakdown.rejected ?? 0}
            sub={pct(summary.statusBreakdown.rejected)}
            iconClass="text-destructive"
            loading={loading}
          />
          <SummaryCard
            icon={Ticket}
            label="Partial"
            value={summary.statusBreakdown.partiallyApproved ?? 0}
            sub={pct(summary.statusBreakdown.partiallyApproved)}
            iconClass="text-orange-500"
            loading={loading}
          />
        </div>
      )}
    </>
  );
}
