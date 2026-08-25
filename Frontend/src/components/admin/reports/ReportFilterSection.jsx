// src/components/admin/reports/ReportFilterSection.jsx

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import {
  Filter,
  X,
  ChevronDown,
  Search,
  SlidersHorizontal,
  Check,
  FileDown,
  FileText,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// SearchableDropdown — single-select
// Used for: Employee, Client, Status, Manager
// ─────────────────────────────────────────────────────────────────────────────
function SearchableDropdown({
  options = [],
  value,
  onChange,
  placeholder,
  labelKey = "name",
  valueKey = "id",
  sublabelKey = null,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const isString = typeof options[0] === "string";
  const getId = (o) => (isString ? o : o[valueKey]);
  const getLbl = (o) => (isString ? o : o[labelKey]);
  const getSub = (o) => (isString || !sublabelKey ? null : o[sublabelKey]);

  const filtered = options.filter((o) =>
    getLbl(o)?.toLowerCase().includes(query.toLowerCase()),
  );

  const selectedOption = options.find((o) => getId(o) === value);
  const selectedLabel = selectedOption ? getLbl(selectedOption) : null;

  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-md text-left hover:border-zinc-400 dark:hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        <span
          className={
            selectedLabel
              ? "text-foreground font-medium truncate"
              : "text-muted-foreground"
          }
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ml-1 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              className="w-full text-left px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-400 dark:text-zinc-500 text-center">
                No results found
              </div>
            ) : (
              filtered.map((o) => {
                const id = getId(o);
                const lbl = getLbl(o);
                const sub = getSub(o);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                      value === id
                        ? "bg-zinc-100 dark:bg-zinc-700 text-primary font-medium"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    <div>{lbl}</div>
                    {sub && (
                      <div className="text-xs text-muted-foreground">{sub}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MultiSelectDropdown — multi-select with checkboxes
// Used for: Project, Ticket
// ─────────────────────────────────────────────────────────────────────────────
function MultiSelectDropdown({
  options = [],
  values = [],
  onChange,
  placeholder,
  labelKey = "name",
  valueKey = "id",
  sublabelKey = null,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const getId = (o) => o[valueKey];
  const getLbl = (o) => o[labelKey];
  const getSub = (o) => (sublabelKey ? o[sublabelKey] : null);

  const filtered = options.filter((o) =>
    getLbl(o)?.toLowerCase().includes(query.toLowerCase()),
  );

  const hasSelections = values && values.length > 0;

  const triggerLabel = (() => {
    if (!hasSelections) return null;
    if (values.length === 1) {
      const found = options.find((o) => getId(o) === values[0]);
      return found ? getLbl(found) : null;
    }
    return `${values.length} selected`;
  })();

  const toggle = (id) => {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  };

  const clearInline = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-zinc-900 border rounded-md text-left hover:border-zinc-400 dark:hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${
          hasSelections
            ? "border-zinc-500 dark:border-zinc-400"
            : "border-zinc-300 dark:border-zinc-600"
        }`}
      >
        <span
          className={`truncate ${triggerLabel ? "text-foreground font-medium" : "text-muted-foreground"}`}
        >
          {triggerLabel || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {hasSelections && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearInline}
              onKeyDown={(e) => e.key === "Enter" && clearInline(e)}
              className="flex items-center justify-center h-4 w-4 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-[calc(100%+4px)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
            <button
              type="button"
              onClick={() =>
                onChange(
                  Array.from(new Set([...values, ...filtered.map(getId)])),
                )
              }
              className="text-xs text-primary hover:underline"
            >
              Select all{query ? " filtered" : ""}
            </button>
            {hasSelections && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-destructive hover:underline"
              >
                Clear ({values.length})
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-400 dark:text-zinc-500 text-center">
                No results found
              </div>
            ) : (
              filtered.map((o) => {
                const id = getId(o);
                const lbl = getLbl(o);
                const sub = getSub(o);
                const selected = values.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${selected ? "bg-zinc-100 dark:bg-zinc-700/60" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                        selected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      }`}
                    >
                      {selected && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 text-left min-w-0">
                      <span
                        className={`block truncate ${selected ? "font-medium text-foreground" : "text-foreground"}`}
                      >
                        {lbl}
                      </span>
                      {sub && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {sub}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {hasSelections && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40">
              <span className="text-xs text-muted-foreground">
                {values.length} item{values.length !== 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterChip — removable tag shown in the active filter bar
// ─────────────────────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-zinc-100 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-full text-xs font-medium text-zinc-700 dark:text-zinc-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center h-4 w-4 rounded-full hover:bg-primary/20 transition-colors"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportFilterSection — main export
// ─────────────────────────────────────────────────────────────────────────────
export function ReportFilterSection({
  filters,
  setFilters,
  filterOptions,
  loadingOptions,
  onApply,
  onReset,
  isAdmin,
  exportMode = "item", // "item" | "header"
  onExportModeChange, // (mode: "item" | "header" | "employee") => void
}) {
  const [expanded, setExpanded] = useState(true);

  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const removeFilter = (key) => {
    if (["projectIds", "ticketIds", "employeeIds", "clientIds"].includes(key))
      update(key, []);
    else update(key, "");
  };

  // ── Build active filter chips ───────────────────────────────
  const chips = [];

  if (filters.employeeIds?.length > 0) {
    if (filters.employeeIds.length === 1) {
      const emp = filterOptions.employees?.find(
        (e) => e.id === filters.employeeIds[0],
      );
      chips.push({
        key: "employeeIds",
        label: `Employee: ${emp?.name || filters.employeeIds[0]}`,
      });
    } else {
      chips.push({
        key: "employeeIds",
        label: `Employees: ${filters.employeeIds.length} selected`,
      });
    }
  }
  if (filters.clientIds?.length > 0) {
    if (filters.clientIds.length === 1) {
      const cl = filterOptions.clients?.find(
        (c) => c.id === filters.clientIds[0],
      );
      chips.push({
        key: "clientIds",
        label: `Client: ${cl?.name || filters.clientIds[0]}`,
      });
    } else {
      chips.push({
        key: "clientIds",
        label: `Clients: ${filters.clientIds.length} selected`,
      });
    }
  }
  if (filters.fromDate)
    chips.push({ key: "fromDate", label: `From: ${filters.fromDate}` });
  if (filters.toDate)
    chips.push({ key: "toDate", label: `To: ${filters.toDate}` });

  if (filters.projectIds?.length > 0) {
    if (filters.projectIds.length === 1) {
      const proj = filterOptions.projects?.find(
        (p) => p.id === filters.projectIds[0],
      );
      chips.push({
        key: "projectIds",
        label: `Project: ${proj?.name || filters.projectIds[0]}`,
      });
    } else {
      chips.push({
        key: "projectIds",
        label: `Projects: ${filters.projectIds.length} selected`,
      });
    }
  }
  if (filters.ticketIds?.length > 0) {
    if (filters.ticketIds.length === 1) {
      const tkt = filterOptions.tickets?.find(
        (t) => t.id === filters.ticketIds[0],
      );
      chips.push({
        key: "ticketIds",
        label: `Ticket: ${tkt?.name || filters.ticketIds[0]}`,
      });
    } else {
      chips.push({
        key: "ticketIds",
        label: `Tickets: ${filters.ticketIds.length} selected`,
      });
    }
  }
  // if (filters.status)
  //   chips.push({
  //     key: "status",
  //     label: `Status: ${filters.status.replace(/_/g, " ")}`,
  //   });
  if (filters.managerId && isAdmin) {
    const mgr = filterOptions.managers?.find((m) => m.id === filters.managerId);
    chips.push({
      key: "managerId",
      label: `Manager: ${mgr?.name || filters.managerId}`,
    });
  }

  const hasFilters = chips.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Filters</CardTitle>
            {hasFilters && (
              <Badge variant="secondary" className="text-xs">
                {chips.length} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-xs h-7"
              >
                <X className="h-3 w-3 mr-1" />
                Reset All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((e) => !e)}
              className="text-xs h-7"
            >
              {expanded ? "Collapse" : "Expand"}
              <ChevronDown
                className={`h-3 w-3 ml-1 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onRemove={() => removeFilter(chip.key)}
              />
            ))}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Employee — multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Employee
                {filters.employeeIds?.length > 0 && (
                  <span className="ml-1.5 text-primary font-semibold">
                    ({filters.employeeIds.length})
                  </span>
                )}
              </Label>
              <MultiSelectDropdown
                options={
                  // When projects are selected, show only employees who have
                  // ticket assignments under those projects (project_id matches)
                  filters.projectIds?.length > 0
                    ? (filterOptions.employees || []).filter((e) => {
                        // Employees are pre-scoped by the server for managers.
                        // For admins, we can't filter client-side without
                        // employee→project mapping, so show all employees.
                        // The server will scope the actual report data.
                        return true;
                      })
                    : filterOptions.employees || []
                }
                values={filters.employeeIds || []}
                onChange={(v) => update("employeeIds", v)}
                placeholder="All Employees"
                sublabelKey="department"
                disabled={loadingOptions}
              />
            </div>

            {/* Client — multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Client
                {filters.clientIds?.length > 0 && (
                  <span className="ml-1.5 text-primary font-semibold">
                    ({filters.clientIds.length})
                  </span>
                )}
              </Label>
              <MultiSelectDropdown
                options={filterOptions.clients || []}
                values={filters.clientIds || []}
                onChange={(v) => update("clientIds", v)}
                placeholder="All Clients"
                sublabelKey="code"
                disabled={loadingOptions}
              />
            </div>

            {/* From Date */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                From Date
                {filters.fromDate && !filters.toDate && (
                  <span className="ml-1 text-primary">(exact day)</span>
                )}
              </Label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => update("fromDate", e.target.value)}
                className="text-sm"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                To Date
              </Label>
              <Input
                type="date"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(e) => update("toDate", e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Project — multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Project
                {filters.projectIds?.length > 0 && (
                  <span className="ml-1.5 text-primary font-semibold">
                    ({filters.projectIds.length})
                  </span>
                )}
              </Label>
              <MultiSelectDropdown
                options={filterOptions.projects || []}
                values={filters.projectIds || []}
                onChange={(v) => update("projectIds", v)}
                placeholder="All Projects"
                sublabelKey="client_name"
                disabled={loadingOptions}
              />
            </div>

            {/* Ticket — multi-select, filtered by selected projects */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Ticket
                {filters.ticketIds?.length > 0 && (
                  <span className="ml-1.5 text-primary font-semibold">
                    ({filters.ticketIds.length})
                  </span>
                )}
              </Label>
              <MultiSelectDropdown
                options={
                  // When one or more projects are selected, show only their tickets
                  filters.projectIds?.length > 0
                    ? (filterOptions.tickets || []).filter((t) =>
                        filters.projectIds.includes(t.project_id),
                      )
                    : filterOptions.tickets || []
                }
                values={filters.ticketIds || []}
                onChange={(v) => update("ticketIds", v)}
                placeholder={
                  filters.projectIds?.length > 0
                    ? "Tickets in selected projects"
                    : "All Tickets"
                }
                sublabelKey="project_name"
                disabled={loadingOptions}
              />
            </div>

            {/* Status — single-select
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">
                Status
              </Label>
              <SearchableDropdown
                options={filterOptions.statuses || []}
                value={filters.status}
                onChange={(v) => update("status", v)}
                placeholder="All Statuses"
                labelKey="name"
                valueKey="name"
                disabled={loadingOptions}
              />
            </div> */}

            {/* Manager — single-select (admin only) */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">
                  Manager
                </Label>
                <SearchableDropdown
                  options={filterOptions.managers || []}
                  value={filters.managerId}
                  onChange={(v) => update("managerId", v)}
                  placeholder="All Managers"
                  disabled={loadingOptions}
                />
              </div>
            )}
          </div>

          {/* ── Export Mode toggle ────────────────────────────────────── */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 mb-3">
              <FileDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Export Format
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* ── Item button ── */}
              <button
                type="button"
                onClick={() => onExportModeChange?.("item")}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium
                  transition-all duration-150 cursor-pointer select-none
                  ${
                    exportMode === "item"
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }
                `}
              >
                {/* Solid radio indicator */}
                {/* <span
                  className={`
                  flex-shrink-0 inline-flex items-center justify-center
                  h-4 w-4 rounded-full border-2
                  ${
                    exportMode === "item"
                      ? "border-primary-foreground bg-primary-foreground"
                      : "border-muted-foreground/40"
                  }
                `}
                >
                  {exportMode === "item" && (
                    <span className="h-2 w-2 rounded-full bg-primary block" />
                  )}
                </span> */}
                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Item</span>
                <span
                  className={`text-xs ${exportMode === "item" ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}
                ></span>
              </button>

              {/* ── Client Billable Data ── */}
              <button
                type="button"
                onClick={() => onExportModeChange?.("header")}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium
                  transition-all duration-150 cursor-pointer select-none
                  ${
                    exportMode === "header"
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }
                `}
              >
                {/* Solid radio indicator */}
                <span
                  className={`
                  flex-shrink-0 inline-flex items-center justify-center
                  h-4 w-4 rounded-full border-2
                  ${
                    exportMode === "header"
                      ? "border-primary-foreground bg-primary-foreground"
                      : "border-muted-foreground/40"
                  }
                `}
                >
                  {exportMode === "header" && (
                    <span className="h-2 w-2 rounded-full bg-primary block" />
                  )}
                </span>
                <FileDown className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Client Billable Data</span>
                <span
                  className={`text-xs ${exportMode === "header" ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}
                ></span>
              </button>

              {/* ── Employee Billable Data button ── */}
              <button
                type="button"
                onClick={() => onExportModeChange?.("employee-billable")}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium
                  transition-all duration-150 cursor-pointer select-none
                  ${
                    exportMode === "employee-billable"
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }
                `}
              >
                {/* Solid radio indicator */}
                <span
                  className={`
                  flex-shrink-0 inline-flex items-center justify-center
                  h-4 w-4 rounded-full border-2
                  ${
                    exportMode === "employee-billable"
                      ? "border-primary-foreground bg-primary-foreground"
                      : "border-muted-foreground/40"
                  }
                `}
                >
                  {exportMode === "employee-billable" && (
                    <span className="h-2 w-2 rounded-full bg-primary block" />
                  )}
                </span>
                <FileDown className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Employee Billable</span>
                <span
                  className={`text-xs ${exportMode === "employee-billable" ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}
                ></span>
              </button>
            </div>
          </div>

          {/* Apply button */}
          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={onApply} className="px-6">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
