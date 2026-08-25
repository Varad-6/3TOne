// src/routes/routes.jsx
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { Login } from "./components/Login";
import AdminDashboard from "./components/dashboards/AdminDashboard";
import { UserManagement } from "./components/admin/UserManagement";
import { ClientManagement } from "./components/admin/ClientManagement";
import { ProjectManagement } from "./components/admin/ProjectManagement";
import { AdminTicketManagement } from "./components/admin/AdminTicketManagement";
import { TaskManagement } from "./components/admin/TaskManagement";
import TicketAssignmentPage from "./components/admin/TicketAssignmentPage";
import ManagerTicketAssignment from "./components/manager/ManagerTicketAssignment";
import { AdminTimesheetApproval } from "./components/admin/AdminTimesheetApproval";
import { AdminReports } from "./components/admin/AdminReports";
import { SystemSettings } from "./components/admin/SystemSettings";
import { ManagerDashboard } from "./components/dashboards/ManagerDashboard";
import ManagerTicketManagement from "./components/manager/ManagerTicketManagement";
import { ManagerTimesheetEntry } from "./components/manager/ManagerTimesheetEntry";
import { TimesheetApproval } from "./components/manager/TimesheetApproval";
import { EmployeeDashboard } from "./components/dashboards/EmployeeDashboard";
import MyTickets from "./components/employee/MyTickets";
import { EmployeeTimesheetEntry } from "./components/employee/EmployeeTimesheetEntry";
import { TimesheetHistory } from "./components/employee/TimesheetHistory";
import { Profile } from "./components/common/Profile";
import { Notifications } from "./components/common/Notifications";
import { useAuth } from "./hooks/useAuth";

/**
 * PUBLIC ROUTE COMPONENT
 * - Redirects authenticated users away from login page
 * - Prevents going back to login after logging in
 */
function PublicRoute({ children }) {
  const { user, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  // If already authenticated, redirect to appropriate dashboard
  if (user) {
    const redirectPath =
      user.role === "ADMIN"
        ? "/admin/dashboard"
        : user.role === "MANAGER"
          ? "/manager/dashboard"
          : "/employee/dashboard";

    // Use replace to prevent back button going to login
    return <Navigate to={redirectPath} replace />;
  }

  // Not authenticated - show login page
  return <>{children}</>;
}

/**
 * PROTECTED ROUTE COMPONENT
 * - Handles authentication and role-based authorization
 * - Saves attempted URL for redirect-after-login
 */
function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  // Now redirects to "/" which becomes "/web/" due to basename
  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (roles && !roles.includes(user.role)) {
    const redirectPath =
      user.role === "ADMIN"
        ? "/admin/dashboard"
        : user.role === "MANAGER"
          ? "/manager/dashboard"
          : "/employee/dashboard";
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

/**
 * ROLE-BASED REDIRECT COMPONENT
 * - Redirects authenticated users to their role-specific dashboard
 */
function RoleBasedRedirect() {
  const { user } = useAuth();

  const redirectPath =
    user?.role === "ADMIN"
      ? "/admin/dashboard"
      : user?.role === "MANAGER"
        ? "/manager/dashboard"
        : "/employee/dashboard";

  return <Navigate to={redirectPath} replace />;
}

/**
 * Layout wrapper that renders nested routes with <Outlet />
 * All protected routes are wrapped in Layout component
 */
function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

/**
 * MAIN APP ROUTES
 * Note: All paths are relative to basename="/web"
 * So "/" actually becomes "/web/" in the browser
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* ============================================ */}
      {/* PUBLIC ROUTES */}
      {/* Root path "/" = "/web/" in browser */}
      {/* ============================================ */}

      <Route
        path="/"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* ============================================ */}
      {/* ALL PROTECTED ROUTES (Wrapped in Layout) */}
      {/* ============================================ */}
      <Route element={<LayoutWrapper />}>
        {/* ============================================ */}
        {/* EMPLOYEE ROUTES */}
        {/* ============================================ */}
        <Route
          path="/employee/dashboard"
          element={
            <ProtectedRoute roles={["EMPLOYEE"]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/my-tickets"
          element={
            <ProtectedRoute roles={["EMPLOYEE"]}>
              <MyTickets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/timesheet"
          element={
            <ProtectedRoute roles={["EMPLOYEE"]}>
              <EmployeeTimesheetEntry />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee/history"
          element={
            <ProtectedRoute roles={["EMPLOYEE"]}>
              <TimesheetHistory />
            </ProtectedRoute>
          }
        />

        {/* ============================================ */}
        {/* MANAGER ROUTES */}
        {/* ============================================ */}
        <Route
          path="/manager/dashboard"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/my-tickets"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <MyTickets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/tickets"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <ManagerTicketManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/assignments"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <ManagerTicketAssignment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/timesheet"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <ManagerTimesheetEntry />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/approvals"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <TimesheetApproval />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/history"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <TimesheetHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager/reports"
          element={
            <ProtectedRoute roles={["MANAGER"]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />

        {/* ============================================ */}
        {/* ADMIN ROUTES */}
        {/* ============================================ */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/clients"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <ClientManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/projects"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <ProjectManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/tickets"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminTicketManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/tasks"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <TaskManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/assignments"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <TicketAssignmentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/timesheet-approval"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <AdminTimesheetApproval />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute roles={["ADMIN", "MANAGER"]}>
              <AdminReports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={["ADMIN"]}>
              <SystemSettings />
            </ProtectedRoute>
          }
        />

        {/* ============================================ */}
        {/* COMMON ROUTES (All Authenticated Users) */}
        {/* ============================================ */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* ============================================ */}
      {/* CATCH ALL - Redirect to Login */}
      {/* ============================================ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
